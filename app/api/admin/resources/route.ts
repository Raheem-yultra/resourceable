import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession, logAdminAction } from '@/lib/admin';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const upsertSchema = z.object({
  title: z.string().trim().min(2).max(200),
  slug: z.string().trim().max(200).optional(),
  summary: z.string().trim().max(500).optional(),
  body: z.string().trim().min(1),
  topicTags: z.array(z.string().trim()).default([]),
  resourceType: z.enum(['ARTICLE', 'GUIDE', 'HOTLINE', 'FORM']).default('ARTICLE'),
  externalUrl: z.union([z.string().url(), z.literal('')]).optional(),
  isPublished: z.boolean().default(true),
  displayOrder: z.coerce.number().int().min(0).default(0),
});

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// GET — all resources (including unpublished) for the admin manager.
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resources = await prisma.resource.findMany({
      orderBy: [{ isPublished: 'desc' }, { displayOrder: 'asc' }, { title: 'asc' }],
    });
    return NextResponse.json({ resources });
  } catch (error) {
    console.error('List resources error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — create a resource.
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = upsertSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || 'Invalid request' }, { status: 400 });
    }
    const d = parsed.data;
    const slug = d.slug ? slugify(d.slug) : slugify(d.title);

    let created;
    try {
      created = await prisma.resource.create({
        data: {
          title: d.title,
          slug,
          summary: d.summary || null,
          body: d.body,
          topicTags: d.topicTags,
          resourceType: d.resourceType,
          externalUrl: d.externalUrl || null,
          isPublished: d.isPublished,
          displayOrder: d.displayOrder,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return NextResponse.json({ error: 'A resource with that slug already exists' }, { status: 409 });
      }
      throw err;
    }

    await logAdminAction({
      adminId: session.user.id,
      action: 'RESOURCE_CREATED',
      targetType: 'Resource',
      targetId: created.id,
      targetLabel: created.title,
      metadata: { slug },
    });

    return NextResponse.json({ resource: created, message: 'Resource created' }, { status: 201 });
  } catch (error) {
    console.error('Create resource error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
