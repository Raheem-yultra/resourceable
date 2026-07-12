import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession, logAdminAction } from '@/lib/admin';
import { sendBusinessRemovedEmail } from '@/lib/email';

export async function DELETE(
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
        { error: 'Removal reason is required' },
        { status: 400 }
      );
    }

    const business = await prisma.business.findUnique({
      where: { id: params.id },
      include: {
        user: true,
        services: { select: { id: true } },
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Log BEFORE deletion so the audit record survives the cascade delete.
    // targetLabel snapshots the name since the Business row is about to be gone.
    await logAdminAction({
      adminId: session.user.id,
      action: 'BUSINESS_REMOVED',
      targetType: 'Business',
      targetId: business.id,
      targetLabel: business.businessName,
      reason: reason.trim(),
      metadata: { servicesRemoved: business.services.length, ownerEmail: business.user.email },
    });

    // Best-effort notification before deletion
    try {
      await sendBusinessRemovedEmail({
        email: business.user.email,
        name: business.user.name || 'Business Owner',
        businessName: business.businessName,
        reason: reason.trim(),
      });
    } catch (emailError) {
      console.error('Failed to send removal email:', emailError);
    }

    // Cascade deletes services/mappings via the Prisma schema relations
    await prisma.business.delete({ where: { id: params.id } });

    return NextResponse.json({
      message: 'Business removed successfully',
      removedBusiness: {
        id: business.id,
        businessName: business.businessName,
        servicesRemoved: business.services.length,
      },
    });
  } catch (error) {
    console.error('Error removing business:', error);
    return NextResponse.json(
      { error: 'Failed to remove business' },
      { status: 500 }
    );
  }
}
