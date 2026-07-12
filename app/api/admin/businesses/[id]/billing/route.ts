import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession, logAdminAction } from '@/lib/admin';
import { extendSubscriptionTrial } from '@/lib/billing';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Manual billing override. Currently supports comping a provider by extending
// their trial to a future date. IMPORTANT: this drives the change through the
// Stripe API (source of truth) and re-syncs the DB — it never edits our billing
// columns directly, so Stripe and our records can't drift.
const overrideSchema = z.object({
  action: z.literal('extend_trial'),
  // Absolute date the (extended) trial should end. Must be in the future.
  trialEndsAt: z.string().datetime(),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = overrideSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const trialEnd = new Date(parsed.data.trialEndsAt);
    if (trialEnd.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Trial end must be a future date' }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { id: params.id },
      select: { id: true, businessName: true, stripeSubscriptionId: true },
    });
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    if (!business.stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'This provider has no subscription yet — nothing to extend.', code: 'NO_SUBSCRIPTION' },
        { status: 409 }
      );
    }

    // Drives Stripe, then re-syncs our DB from the returned subscription.
    const result = await extendSubscriptionTrial(business.id, trialEnd);

    await logAdminAction({
      adminId: session.user.id,
      action: 'BUSINESS_BILLING_OVERRIDE',
      targetType: 'Business',
      targetId: business.id,
      targetLabel: business.businessName,
      reason: parsed.data.reason,
      metadata: { override: 'extend_trial', trialEndsAt: trialEnd.toISOString() },
    });

    return NextResponse.json({
      message: 'Trial extended successfully',
      subscriptionStatus: result?.status ?? null,
    });
  } catch (error: any) {
    console.error('Billing override error:', error);
    // Surface the friendly message from lib/billing for the "no subscription" race, etc.
    return NextResponse.json(
      { error: error?.message || 'Failed to apply billing override' },
      { status: 500 }
    );
  }
}
