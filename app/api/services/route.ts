import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceService } from '@/services/service.service';
import { businessService } from '@/services/business.service';
import { serviceSchema } from '@/lib/validations';

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

    const body = await req.json();
    const validatedData = serviceSchema.parse(body);

    const service = await serviceService.createService(business.id, {
      name: validatedData.name,
      description: validatedData.description,
      ageGroups: validatedData.ageGroups as any,
      ageMin: validatedData.ageMin,
      ageMax: validatedData.ageMax,
      priceRange: validatedData.priceRange as any,
      priceMin: validatedData.priceMin,
      priceMax: validatedData.priceMax,
      insuranceAccepted: validatedData.insuranceAccepted,
      isAvailable: validatedData.isAvailable,
    });

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
