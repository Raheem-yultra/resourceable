import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession, logAdminAction } from '@/lib/admin';
import { sendBusinessSuspendedEmail } from '@/lib/email';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reason } = await request.json();

    if (!reason?.trim()) {
      return NextResponse.json(
        { error: 'Suspension reason is required' },
        { status: 400 }
      );
    }

    const business = await prisma.business.findUnique({
      where: { id: params.id },
      include: { user: true },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (business.verificationStatus !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Only approved businesses can be suspended' },
        { status: 400 }
      );
    }

    if (business.isSuspended) {
      return NextResponse.json(
        { error: 'Business is already suspended' },
        { status: 400 }
      );
    }

    // Suspend WITHOUT touching verificationStatus so approval history is preserved.
    // Public visibility keys off isActive, so setting it false hides the listing.
    await prisma.business.update({
      where: { id: params.id },
      data: {
        isActive: false,
        isSuspended: true,
        suspendedAt: new Date(),
        suspendedBy: session.user.id,
        suspensionReason: reason.trim(),
      },
    });

    await logAdminAction({
      adminId: session.user.id,
      action: 'BUSINESS_SUSPENDED',
      targetType: 'Business',
      targetId: business.id,
      targetLabel: business.businessName,
      reason: reason.trim(),
    });

    // Best-effort notification — don't fail the request if email is down
    try {
      await sendBusinessSuspendedEmail({
        email: business.user.email,
        name: business.user.name || 'Business Owner',
        businessName: business.businessName,
        reason: reason.trim(),
      });
    } catch (emailError) {
      console.error('Failed to send suspension email:', emailError);
    }

    return NextResponse.json({
      message: 'Business suspended successfully',
      business: { id: business.id, businessName: business.businessName },
    });
  } catch (error) {
    console.error('Error suspending business:', error);
    return NextResponse.json(
      { error: 'Failed to suspend business' },
      { status: 500 }
    );
  }
}
