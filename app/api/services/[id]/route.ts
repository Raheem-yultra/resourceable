import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceService } from '@/services/service.service';
import { serviceSchema } from '@/lib/validations';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const service = await serviceService.getServiceById(params.id);

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    return NextResponse.json({ service });
  } catch (error) {
    console.error('Get service error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'BUSINESS') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = await serviceService.getServiceById(params.id);
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Verify ownership
    if (service.business.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const validatedData = serviceSchema.partial().parse(body);

    const updatedService = await serviceService.updateService(params.id, {
      ...validatedData,
      serviceTypes: validatedData.serviceTypes as any,
      disabilityTypes: validatedData.disabilityTypes as any,
    });

    return NextResponse.json({ service: updatedService });
  } catch (error: any) {
    console.error('Update service error:', error);
    
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'BUSINESS') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = await serviceService.getServiceById(params.id);
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Verify ownership
    if (service.business.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await serviceService.deleteService(params.id);

    return NextResponse.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Delete service error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
