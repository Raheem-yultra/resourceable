import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession, logAdminAction } from '@/lib/admin';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  verificationLevel: z.enum(['UNVERIFIED', 'BASIC_VERIFIED', 'LICENSED']),
  reason: z.string().trim().max(1000).optional(),
});

// Set a provider's trust tier (plan §4). Because Service.verificationLevel is a
// denormalized copy (for fast search filter/rank), we update the business AND all
// its listings in one transaction so search never shows a stale tier badge.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || 'Invalid request' }, { status: 400 });
    }
    const { verificationLevel, reason } = parsed.data;

    const business = await prisma.business.findUnique({
      where: { id: params.id },
      select: { id: true, businessName: true, verificationLevel: true },
    });
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const [updated] = await prisma.$transaction([
      prisma.business.update({
        where: { id: business.id },
        data: { verificationLevel },
        select: { id: true, verificationLevel: true },
      }),
      // Keep the denormalized copy on every listing in sync.
      prisma.service.updateMany({
        where: { businessId: business.id },
        data: { verificationLevel },
      }),
    ]);

    await logAdminAction({
      adminId: session.user.id,
      action: 'BUSINESS_VERIFICATION_LEVEL',
      targetType: 'Business',
      targetId: business.id,
      targetLabel: business.businessName,
      reason: reason ?? null,
      metadata: { from: business.verificationLevel, to: verificationLevel },
    });

    return NextResponse.json({ verificationLevel: updated.verificationLevel, success: true });
  } catch (error) {
    console.error('Set verification level error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
