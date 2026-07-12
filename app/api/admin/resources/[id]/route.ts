import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession, logAdminAction } from '@/lib/admin';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  summary: z.string().trim().max(500).optional(),
  body: z.string().trim().min(1).optional(),
  topicTags: z.array(z.string().trim()).optional(),
  resourceType: z.enum(['ARTICLE', 'GUIDE', 'HOTLINE', 'FORM']).optional(),
  externalUrl: z.union([z.string().url(), z.literal('')]).optional(),
  isPublished: z.boolean().optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});

// PATCH — edit a resource / toggle publish.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || 'Invalid request' }, { status: 400 });
    }
    const d = parsed.data;

    const existing = await prisma.resource.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Resource not found' }, { status: 404 });

    const resource = await prisma.resource.update({
      where: { id: params.id },
      data: {
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.summary !== undefined ? { summary: d.summary || null } : {}),
        ...(d.body !== undefined ? { body: d.body } : {}),
        ...(d.topicTags !== undefined ? { topicTags: d.topicTags } : {}),
        ...(d.resourceType !== undefined ? { resourceType: d.resourceType } : {}),
        ...(d.externalUrl !== undefined ? { externalUrl: d.externalUrl || null } : {}),
        ...(d.isPublished !== undefined ? { isPublished: d.isPublished } : {}),
        ...(d.displayOrder !== undefined ? { displayOrder: d.displayOrder } : {}),
      },
    });

    await logAdminAction({
      adminId: session.user.id,
      action: 'RESOURCE_UPDATED',
      targetType: 'Resource',
      targetId: resource.id,
      targetLabel: resource.title,
      metadata: { isPublished: resource.isPublished },
    });

    return NextResponse.json({ resource, success: true });
  } catch (error) {
    console.error('Update resource error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — remove a resource permanently.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const existing = await prisma.resource.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Resource not found' }, { status: 404 });

    await prisma.resource.delete({ where: { id: params.id } });

    await logAdminAction({
      adminId: session.user.id,
      action: 'RESOURCE_ARCHIVED',
      targetType: 'Resource',
      targetId: existing.id,
      targetLabel: existing.title,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete resource error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
