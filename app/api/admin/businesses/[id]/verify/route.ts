import { NextRequest, NextResponse } from 'next/server';
import { businessService } from '@/services/business.service';
import { getAdminSession, logAdminAction } from '@/lib/admin';
import { onBusinessApproved } from '@/lib/billing';
import { z } from 'zod';

const verifySchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().optional(),
  adminNotes: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validation = verifySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { status, rejectionReason, adminNotes } = validation.data;

    // Require rejection reason when rejecting
    if (status === 'REJECTED' && !rejectionReason?.trim()) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    const business = await businessService.updateVerificationStatus(
      params.id,
      status,
      {
        rejectionReason,
        adminNotes,
        reviewedBy: session.user.id,
      }
    );

    // Record who made this decision and why
    await logAdminAction({
      adminId: session.user.id,
      action: status === 'APPROVED' ? 'BUSINESS_APPROVED' : 'BUSINESS_REJECTED',
      targetType: 'Business',
      targetId: business.id,
      targetLabel: business.businessName,
      reason: status === 'REJECTED' ? rejectionReason : undefined,
    });

    // On approval, kick off billing onboarding (create Stripe customer + email).
    // Self-contained/best-effort — never blocks the approval response.
    if (status === 'APPROVED') {
      await onBusinessApproved(business.id);
    }

    return NextResponse.json({
      business,
      message: `Business ${status.toLowerCase()} successfully`
    });
  } catch (error: any) {
    console.error('Update verification status error:', error);

    if (error.message === 'Business not found') {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
