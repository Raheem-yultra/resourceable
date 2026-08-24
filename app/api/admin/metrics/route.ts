import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/admin';

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
      openReports,
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
      // Open safety/accuracy reports awaiting an admin. This is the queue that
      // matters most on a directory serving vulnerable families, so it is a
      // first-class metric rather than something only visible under Reports.
      prisma.report.count({ where: { status: 'OPEN' } }),
    ]);

    const listingsPerCategory = serviceTypes
      .map((s) => ({ id: s.id, name: s.name, category: s.category, count: s._count.services }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
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
      flaggedContent: openReports,
    });
  } catch (error) {
    console.error('Admin metrics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
