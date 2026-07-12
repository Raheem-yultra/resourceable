import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { businessService } from '@/services/business.service';
import { getAdminSession } from '@/lib/admin';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  search: z.string().trim().max(200).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  // Optional billing filter. 'none' targets approved providers with no subscription row yet.
  subscriptionStatus: z
    .enum(['trialing', 'active', 'past_due', 'canceled', 'suspended_billing', 'none'])
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      search: searchParams.get('search') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      subscriptionStatus: searchParams.get('subscriptionStatus') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Shows all APPROVED businesses (active AND suspended) so admins can reinstate suspended ones
    const where = businessService.buildAdminFilter(
      { verificationStatus: 'APPROVED' },
      {
        search: parsed.data.search,
        dateFrom: parsed.data.dateFrom ? new Date(parsed.data.dateFrom) : undefined,
        dateTo: parsed.data.dateTo ? new Date(parsed.data.dateTo) : undefined,
      }
    );

    // Optional billing filter: 'none' = no subscription row yet; otherwise exact status.
    if (parsed.data.subscriptionStatus) {
      where.subscriptionStatus =
        parsed.data.subscriptionStatus === 'none' ? null : parsed.data.subscriptionStatus;
    }

    const businesses = await prisma.business.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, name: true } },
        businessDisabilities: {
          include: { disability: { select: { name: true, slug: true } } },
        },
        services: {
          include: {
            serviceTypes: { include: { serviceType: { select: { name: true } } } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { services: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ businesses });
  } catch (error) {
    console.error('Error fetching approved businesses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch businesses' },
      { status: 500 }
    );
  }
}
