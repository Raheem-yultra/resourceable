import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { serviceService } from '@/services/service.service';
import { reviewSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

// GET /api/reviews?serviceId=... — published reviews for a listing (newest first).
export async function GET(req: NextRequest) {
  try {
    const serviceId = new URL(req.url).searchParams.get('serviceId');
    if (!serviceId) {
      return NextResponse.json({ error: 'serviceId is required' }, { status: 400 });
    }
    const reviews = await prisma.review.findMany({
      relationLoadStrategy: 'join',
      where: { serviceId, isPublished: true },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true } } },
    });
    return NextResponse.json({ reviews });
  } catch (error) {
    console.error('List reviews error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/reviews — a signed-in family member reviews a listing (one per listing).
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Please sign in to leave a review.' }, { status: 401 });
    }

    const parsed = reviewSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || 'Invalid review' }, { status: 400 });
    }
    const { serviceId, rating, title, content } = parsed.data;

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, businessId: true, business: { select: { userId: true, subscriptionStatus: true } } },
    });
    if (!service) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }
    // Providers can't review their own listing.
    if (service.business.userId === session.user.id) {
      return NextResponse.json({ error: 'You cannot review your own listing.' }, { status: 403 });
    }

    // One review per (user, listing): upsert so re-submitting edits the existing one.
    await prisma.review.upsert({
      where: { userId_serviceId: { userId: session.user.id, serviceId } },
      create: {
        userId: session.user.id,
        businessId: service.businessId,
        serviceId,
        rating,
        title: title || null,
        content,
      },
      update: { rating, title: title || null, content },
    });

    // Recompute the listing's aggregate, and the business-level aggregate too.
    await serviceService.recomputeServiceRating(serviceId);
    const bizAgg = await prisma.review.aggregate({
      where: { businessId: service.businessId, isPublished: true },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await prisma.business.update({
      where: { id: service.businessId },
      data: { averageRating: bizAgg._avg.rating ?? null, totalReviews: bizAgg._count._all },
    });

    return NextResponse.json({ success: true, message: 'Thanks for your review!' }, { status: 201 });
  } catch (error) {
    console.error('Create review error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
