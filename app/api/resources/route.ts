import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Public, read-only view of the Resources knowledge base.
//
// /resources renders server-side and queries Prisma directly, but the combined
// "Events & Resources" browse category is a client component that can be switched
// into without a navigation, so it needs an endpoint. Published rows only — the
// admin routes stay the only way to see unpublished drafts.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const topic = req.nextUrl.searchParams.get('topic');
    const limitParam = Number(req.nextUrl.searchParams.get('limit'));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 12;

    const resources = await prisma.resource.findMany({
      where: {
        isPublished: true,
        ...(topic ? { topicTags: { has: topic } } : {}),
      },
      orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        topicTags: true,
        resourceType: true,
        externalUrl: true,
      },
    });

    return NextResponse.json({ resources });
  } catch (error) {
    console.error('Failed to load resources:', error);
    return NextResponse.json({ error: 'Failed to load resources' }, { status: 500 });
  }
}
