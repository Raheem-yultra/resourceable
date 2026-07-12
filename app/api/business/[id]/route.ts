import { NextRequest, NextResponse } from 'next/server';
import { businessService } from '@/services/business.service';
import { isBillingBlocked } from '@/lib/billing';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const business = await businessService.getBusinessById(params.id);

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Only show approved, active (non-suspended) businesses whose billing is
    // current. Lapsed billing (suspended/canceled) hides the listing publicly.
    if (
      business.verificationStatus !== 'APPROVED' ||
      !business.isActive ||
      isBillingBlocked(business.subscriptionStatus)
    ) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    return NextResponse.json({ business });
  } catch (error) {
    console.error('Get business error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
