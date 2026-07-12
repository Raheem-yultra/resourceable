import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createSubscriptionCheckout } from '@/lib/billing';

export const dynamic = 'force-dynamic';

// Starts the redirect Checkout flow to collect a card + begin the 30-day trial.
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'BUSINESS') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { userId: session.user.id },
      select: { id: true, verificationStatus: true, subscriptionStatus: true },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Billing only opens once the provider is approved (they aren't live before that).
    if (business.verificationStatus !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Your business must be approved before setting up billing.' },
        { status: 403 }
      );
    }

    // Already on an active/trialing subscription → nothing to check out; use the portal instead.
    if (business.subscriptionStatus === 'active' || business.subscriptionStatus === 'trialing') {
      return NextResponse.json(
        { error: 'You already have an active subscription. Use Manage Billing to make changes.' },
        { status: 409 }
      );
    }

    const url = await createSubscriptionCheckout(business.id);
    return NextResponse.json({ url });
  } catch (error) {
    console.error('Create checkout session error:', error);
    return NextResponse.json({ error: 'Failed to start checkout' }, { status: 500 });
  }
}
