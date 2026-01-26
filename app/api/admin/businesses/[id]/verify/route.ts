import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { businessService } from '@/services/business.service';
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
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validation = verifySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error },
        { status: 400 }
      );
    }

    const { status, rejectionReason, adminNotes } = validation.data;

    // Require rejection reason when rejecting
    if (status === 'REJECTED' && !rejectionReason) {
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

