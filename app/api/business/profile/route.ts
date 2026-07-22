import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { businessService } from '@/services/business.service';
import { businessProfileUpdateSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';
import { runVerificationChecks } from '@/lib/verification';

export const dynamic = 'force-dynamic';

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

    // Update or create business profile
    const business = await prisma.business.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
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
      },
      update: {
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
      },
    });

    // The business is backed by a single Service record holding pricing/age/insurance
    const existingService = await prisma.service.findFirst({
      where: { businessId: business.id },
    });

    // Parse optional event dates; invalid/empty -> null.
    const parseDate = (v?: string) => {
      if (!v || !v.trim()) return null;
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    };

    const serviceData = {
      name: `${data.businessName} Services`,
      slug: data.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: orNull(data.description) || 'Professional services',
      priceRange: data.priceRange,
      priceMin: data.priceMin ?? null,
      priceMax: data.priceMax ?? null,
      pricingDetails: orNull(data.pricingDetails),
      ageGroups: data.ageGroups,
      capacity: data.capacity ?? null,
      insuranceAccepted: data.insuranceAccepted,
      insuranceProviders: data.acceptedInsurances
        ? data.acceptedInsurances.split(',').map((i) => i.trim()).filter(Boolean)
        : [],
      // --- Category-expansion: listing kind, trust tier (inherited from the
      // provider), and type-specific extension fields. ---
      listingType: data.listingType,
      // Denormalize the provider's verification tier onto the listing so search
      // can filter/rank on it without a join. Admin tier changes re-sync this (P8).
      verificationLevel: business.verificationLevel,
      deliveryMode: data.deliveryMode ?? null,
      condition: data.listingType === 'SHOP' ? data.condition ?? null : null,
      isForRent: data.listingType === 'SHOP' ? data.isForRent : false,
      brand: data.listingType === 'SHOP' ? orNull(data.brand) : null,
      enrollmentStatus: data.listingType === 'SCHOOL' ? orNull(data.enrollmentStatus) : null,
      programType: data.listingType === 'SCHOOL' ? orNull(data.programType) : null,
      gradeLevels: data.listingType === 'SCHOOL' ? data.gradeLevels : [],
      startDate: data.listingType === 'EVENT' ? parseDate(data.startDate) : null,
      endDate: data.listingType === 'EVENT' ? parseDate(data.endDate) : null,
      isVirtual: data.listingType === 'EVENT' ? data.isVirtual : false,
    };

    const service = existingService
      ? await prisma.service.update({ where: { id: existingService.id }, data: serviceData })
      : await prisma.service.create({ data: { ...serviceData, businessId: business.id } });

    // Sync service-type mappings to EXACTLY the submitted set — batch the slug
    // lookup + inserts, and always clear first so unchecking everything works.
    await prisma.serviceTypeMap.deleteMany({ where: { serviceId: service.id } });
    if (data.serviceTypes.length > 0) {
      const types = await prisma.serviceType.findMany({
        where: { slug: { in: data.serviceTypes } },
        select: { id: true },
      });
      if (types.length > 0) {
        await prisma.serviceTypeMap.createMany({
          data: types.map((t) => ({ serviceId: service.id, serviceTypeId: t.id })),
          skipDuplicates: true,
        });
      }
    }

    // Sync disability mappings — same clear-then-recreate approach
    await prisma.businessDisability.deleteMany({ where: { businessId: business.id } });
    if (data.disabilityTypes.length > 0) {
      const disabilities = await prisma.disability.findMany({
        where: { slug: { in: data.disabilityTypes } },
        select: { id: true },
      });
      if (disabilities.length > 0) {
        await prisma.businessDisability.createMany({
          data: disabilities.map((d) => ({ businessId: business.id, disabilityId: d.id })),
          skipDuplicates: true,
        });
      }
    }

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
