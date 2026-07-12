import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession, logAdminAction } from '@/lib/admin';
import { z } from 'zod';

const kindSchema = z.enum(['serviceType', 'disability']);

// Edit fields and/or archive (isActive:false) / restore (isActive:true)
const updateSchema = z.object({
  kind: kindSchema,
  name: z.string().trim().min(2).max(120).optional(),
  slug: z.string().trim().max(140).optional(),
  category: z.string().trim().max(120).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  // ServiceType only; '' clears it to null.
  listingType: z.enum(['SERVICE', 'THERAPY', 'SHOP', 'SCHOOL', 'EVENT', '']).optional(),
});

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { kind, isActive, name, slug, category, description, displayOrder, listingType } = parsed.data;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (slug !== undefined) data.slug = slugify(slug);
    if (category !== undefined) data.category = category || null;
    if (description !== undefined) data.description = description || null;
    if (displayOrder !== undefined) data.displayOrder = displayOrder;
    if (isActive !== undefined) data.isActive = isActive;
    // listingType only applies to service types; '' clears it.
    if (listingType !== undefined && kind === 'serviceType') data.listingType = listingType || null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const targetType = kind === 'serviceType' ? 'ServiceType' : 'Disability';
    let updated: { id: string; name: string };
    try {
      updated = kind === 'serviceType'
        ? await prisma.serviceType.update({ where: { id: params.id }, data, select: { id: true, name: true } })
        : await prisma.disability.update({ where: { id: params.id }, data, select: { id: true, name: true } });
    } catch (err: any) {
      if (err?.code === 'P2025') {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }
      if (err?.code === 'P2002') {
        return NextResponse.json({ error: 'A category with that name or slug already exists' }, { status: 409 });
      }
      throw err;
    }

    // Distinguish archive/restore from a plain edit in the audit log
    const action = isActive === false ? 'CATEGORY_ARCHIVED' : isActive === true ? 'CATEGORY_RESTORED' : 'CATEGORY_UPDATED';
    await logAdminAction({
      adminId: session.user.id,
      action,
      targetType,
      targetId: updated.id,
      targetLabel: updated.name,
      metadata: { kind },
    });

    return NextResponse.json({ item: updated, message: 'Category updated' });
  } catch (error) {
    console.error('Taxonomy update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
