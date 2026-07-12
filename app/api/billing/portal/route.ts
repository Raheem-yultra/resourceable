import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createBillingPortalSession } from '@/lib/billing';

export const dynamic = 'force-dynamic';

// Opens a Stripe Customer Portal session so the provider can update their card,
// view invoices, or cancel. Used both by healthy subscribers ("Manage Billing")
// and past_due/suspended providers trying to fix payment ("Update payment").
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'BUSINESS') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { userId: session.user.id },
      select: { id: true, stripeCustomerId: true },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // No Stripe customer yet means they never started checkout — send them there.
    if (!business.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No billing account yet. Set up billing first.', code: 'NO_CUSTOMER' },
        { status: 409 }
      );
    }

    const url = await createBillingPortalSession(business.id);
    return NextResponse.json({ url });
  } catch (error) {
    console.error('Create billing portal session error:', error);
    return NextResponse.json({ error: 'Failed to open billing portal' }, { status: 500 });
  }
}
