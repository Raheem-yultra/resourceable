import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Reporting/flagging is available on every listing from launch (plan §4) — not
// optional given the vulnerable population served. Guests may report too, so a
// session is optional; when present we attribute the report to the user.
const reportSchema = z.object({
  serviceId: z.string().cuid(),
  reason: z.enum([
    'inaccurate',
    'inappropriate',
    'scam',
    'closed',
    'safety',
    'other',
  ]),
  details: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = reportSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid report', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { serviceId, reason, details } = parsed.data;

    // Ensure the listing exists (and grab its business for admin context).
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, businessId: true },
    });
    if (!service) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    let reportedById: string | undefined;
    try {
      const session = await getServerSession(authOptions);
      reportedById = session?.user?.id;
    } catch {
      // Guest report — fine.
    }

    await prisma.report.create({
      data: {
        serviceId: service.id,
        businessId: service.businessId,
        reportedById: reportedById ?? null,
        reason,
        details: details || null,
      },
    });

    return NextResponse.json({ success: true, message: 'Thanks — our team will review this listing.' }, { status: 201 });
  } catch (error) {
    console.error('Create report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
