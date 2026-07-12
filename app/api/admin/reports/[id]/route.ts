import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession, logAdminAction } from '@/lib/admin';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  status: z.enum(['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED']),
  note: z.string().trim().max(1000).optional(),
});

// PATCH — moderate a report: move it through the review workflow. Every change is
// audit-logged (plan §4 trust infrastructure).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || 'Invalid request' }, { status: 400 });
    }

    const existing = await prisma.report.findUnique({
      where: { id: params.id },
      include: { service: { select: { name: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const isTerminal = parsed.data.status === 'RESOLVED' || parsed.data.status === 'DISMISSED';
    const report = await prisma.report.update({
      where: { id: params.id },
      data: {
        status: parsed.data.status,
        resolvedById: isTerminal ? session.user.id : null,
        resolvedAt: isTerminal ? new Date() : null,
      },
    });

    await logAdminAction({
      adminId: session.user.id,
      action: 'REPORT_RESOLVED',
      targetType: 'Report',
      targetId: report.id,
      targetLabel: existing.service?.name ?? null,
      reason: parsed.data.note ?? null,
      metadata: { status: parsed.data.status, serviceId: existing.serviceId },
    });

    return NextResponse.json({ report, success: true });
  } catch (error) {
    console.error('Update report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
