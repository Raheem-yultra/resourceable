import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceService } from '@/services/service.service';
import { businessService } from '@/services/business.service';
import { listingSchema } from '@/lib/validations';
import { isBillingBlocked } from '@/lib/billing';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'BUSINESS') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await businessService.getBusinessByUserId(session.user.id);
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const services = await serviceService.getServicesByBusinessId(business.id);
    return NextResponse.json({ services });
  } catch (error) {
    console.error('Get services error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'BUSINESS') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await businessService.getBusinessByUserId(session.user.id);
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Block listing creation when billing has lapsed (suspended/canceled).
    if (isBillingBlocked(business.subscriptionStatus)) {
      return NextResponse.json(
        { error: 'Your subscription is inactive. Reactivate billing to manage listings.', code: 'BILLING_INACTIVE' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = listingSchema.parse(body);

    const service = await serviceService.createListing(business.id, validatedData);

    return NextResponse.json({ service }, { status: 201 });
  } catch (error: any) {
    console.error('Create service error:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
