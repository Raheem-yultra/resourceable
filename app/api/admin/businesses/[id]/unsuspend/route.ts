import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession, logAdminAction } from '@/lib/admin';
import { sendBusinessUnsuspendedEmail } from '@/lib/email';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { id: params.id },
      include: { user: true },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (!business.isSuspended) {
      return NextResponse.json(
        { error: 'Business is not currently suspended' },
        { status: 400 }
      );
    }

    // Reinstate: restore visibility and clear suspension metadata.
    // verificationStatus was never changed, so it returns to its prior APPROVED state.
    await prisma.business.update({
      where: { id: params.id },
      data: {
        isActive: true,
        isSuspended: false,
        suspendedAt: null,
        suspendedBy: null,
        suspensionReason: null,
      },
    });

    await logAdminAction({
      adminId: session.user.id,
      action: 'BUSINESS_UNSUSPENDED',
      targetType: 'Business',
      targetId: business.id,
      targetLabel: business.businessName,
    });

    try {
      await sendBusinessUnsuspendedEmail({
        email: business.user.email,
        name: business.user.name || 'Business Owner',
        businessName: business.businessName,
      });
    } catch (emailError) {
      console.error('Failed to send reinstatement email:', emailError);
    }

    return NextResponse.json({
      message: 'Business reinstated successfully',
      business: { id: business.id, businessName: business.businessName },
    });
  } catch (error) {
    console.error('Error reinstating business:', error);
    return NextResponse.json(
      { error: 'Failed to reinstate business' },
      { status: 500 }
    );
  }
}
