import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/admin';
import { getMonthlyPrice } from '@/lib/billing';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      newSignups30d,
      newSignups7d,
      pendingApprovals,
      approvedActive,
      suspended,
      rejected,
      totalUsers,
      totalBusinesses,
      serviceTypes,
      subStatusGroups,
      churnThisMonth,
      price,
    ] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.business.count({ where: { verificationStatus: 'PENDING' } }),
      prisma.business.count({ where: { verificationStatus: 'APPROVED', isActive: true } }),
      prisma.business.count({ where: { isSuspended: true } }),
      prisma.business.count({ where: { verificationStatus: 'REJECTED' } }),
      prisma.user.count(),
      prisma.business.count(),
      // Active listings per category (service type)
      prisma.serviceType.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, category: true, _count: { select: { services: true } } },
      }),
      // Subscriber counts by billing status (one grouped query)
      prisma.business.groupBy({
        by: ['subscriptionStatus'],
        _count: { _all: true },
      }),
      // Churn proxy: subscriptions Stripe reported deleted so far this month.
      // Uses the idempotency ledger, which records every processed event by type+time.
      prisma.processedStripeEvent.count({
        where: { type: 'customer.subscription.deleted', processedAt: { gte: startOfMonth } },
      }),
      // Monthly unit price for MRR (null if Stripe isn't configured — MRR degrades to null)
      getMonthlyPrice(),
    ]);

    const listingsPerCategory = serviceTypes
      .map((s) => ({ id: s.id, name: s.name, category: s.category, count: s._count.services }))
      .sort((a, b) => b.count - a.count);

    // Tally subscriber counts by status from the grouped result.
    const subCount = (status: string) =>
      subStatusGroups.find((g) => g.subscriptionStatus === status)?._count._all ?? 0;
    const activeSubscribers = subCount('active');
    const trialing = subCount('trialing');
    // MRR counts only paying (active) subscribers; trialing aren't billed yet.
    const mrrCents = price ? activeSubscribers * price.unitAmount : null;

    const billing = {
      activeSubscribers,
      trialing,
      pastDue: subCount('past_due'),
      suspendedBilling: subCount('suspended_billing'),
      canceled: subCount('canceled'),
      unitAmountCents: price?.unitAmount ?? null,
      currency: price?.currency ?? null,
      mrrCents,
      churnThisMonth,
    };

    return NextResponse.json({
      billing,
      signups: { last7Days: newSignups7d, last30Days: newSignups30d },
      businesses: {
        pending: pendingApprovals,
        approvedActive,
        suspended,
        rejected,
        total: totalBusinesses,
      },
      users: { total: totalUsers },
      listingsPerCategory,
      // No reporting/flagging system exists yet; surfaced as null so the UI can say so honestly.
      flaggedContent: null,
    });
  } catch (error) {
    console.error('Admin metrics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
