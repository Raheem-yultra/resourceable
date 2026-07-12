import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/admin';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  status: z.enum(['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED']).optional(),
});

// GET — list reports (newest first), optionally filtered by status, with the
// reported listing + provider for moderation context.
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({ status: searchParams.get('status') || undefined });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }

    const where = parsed.data.status ? { status: parsed.data.status } : {};
    const [reports, openCount] = await Promise.all([
      prisma.report.findMany({
        relationLoadStrategy: 'join',
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          service: {
            select: {
              id: true,
              name: true,
              listingType: true,
              business: { select: { id: true, businessName: true } },
            },
          },
          reportedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.report.count({ where: { status: 'OPEN' } }),
    ]);

    return NextResponse.json({ reports, openCount });
  } catch (error) {
    console.error('List reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
