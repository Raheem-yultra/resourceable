import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { businessService } from '@/services/business.service';
import { businessProfileUpdateSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { runVerificationChecks } from '@/lib/verification';

export const dynamic = 'force-dynamic';

// The save runs the pre-approval checks inline (below), which are network-bound
// against three public registries. The default function budget is tight enough
// that a slow registry would surface to the provider as a failed save even though
// the write already committed; this gives the whole request explicit headroom.
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    // Only business owners have a profile to fetch; fail fast rather than run a doomed query
    if (!session?.user || session.user.role !== 'BUSINESS') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await businessService.getBusinessByUserId(session.user.id);
    
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    return NextResponse.json({ business });
  } catch (error) {
    console.error('Get business error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'BUSINESS') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate the ENTIRE payload up front so a bad value fails before any write (no partial saves)
    const parsed = businessProfileUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return NextResponse.json(
        { error: first?.message || 'Invalid form data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const orNull = (v?: string) => (v && v.trim() ? v.trim() : null);

    // This route writes the PROVIDER ONLY. It deliberately never touches Service:
    // a business owns many listings, and a profile save that reached into
    // `service.findFirst()` used to rename and overwrite whichever listing happened
    // to come back first. Listings are managed solely through /api/services.
    const businessFields = {
      businessName: data.businessName.trim(),
      businessType: orNull(data.businessType),
      description: orNull(data.description),
      phone: orNull(data.phone),
      email: orNull(data.email),
      website: orNull(data.website),
      address: orNull(data.address),
      addressLine2: orNull(data.addressLine2),
      city: orNull(data.city),
      state: orNull(data.state),
      zipCode: orNull(data.zipCode),
      yearEstablished: data.yearEstablished ?? null,
      licenseNumber: orNull(data.licenseNumber),
      npi: data.npi ?? null,
      taxId: data.taxId ?? null,
      // A Json column needs DbNull to be cleared — plain `undefined` would leave a
      // previously saved schedule in place when the provider empties every day.
      hoursOfOperation: data.hoursOfOperation ?? Prisma.DbNull,
    };

    const business = await prisma.business.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, ...businessFields },
      update: businessFields,
    });

    // Sync disability mappings — clear-then-recreate so unchecking everything works.
    // Both halves run in ONE transaction: a failure between them would otherwise
    // leave the provider with every mapping deleted and none restored, silently
    // dropping them out of the disability filter that families search by.
    const disabilities =
      data.disabilityTypes.length > 0
        ? await prisma.disability.findMany({
            where: { slug: { in: data.disabilityTypes } },
            select: { id: true },
          })
        : [];

    await prisma.$transaction([
      prisma.businessDisability.deleteMany({ where: { businessId: business.id } }),
      ...(disabilities.length > 0
        ? [
            prisma.businessDisability.createMany({
              data: disabilities.map((d) => ({ businessId: business.id, disabilityId: d.id })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    // Re-run the automated pre-approval checks so the admin queue always reflects what
    // the provider just submitted. Only while PENDING — that's the gate these inform;
    // for live providers an admin re-runs them on demand from the queue.
    // Awaited (fire-and-forget is unreliable on serverless) but fully isolated: the
    // checks are network-bound and must never fail or roll back the provider's save.
    if (business.verificationStatus === 'PENDING') {
      try {
        await runVerificationChecks(business.id);
      } catch (checkError) {
        console.error('Verification checks failed for business', business.id, checkError);
      }
    }

    return NextResponse.json({ business, success: true });
  } catch (error: any) {
    console.error('Update business error:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
