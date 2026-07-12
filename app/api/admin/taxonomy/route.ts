import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession, logAdminAction } from '@/lib/admin';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// The platform "categories" are its two taxonomies: ServiceType and Disability.
// Managing these rows (add / edit / archive) is category management without a code deploy.
const kindSchema = z.enum(['serviceType', 'disability']);

const createSchema = z.object({
  kind: kindSchema,
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  slug: z.string().trim().max(140).optional(),
  category: z.string().trim().max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  // Only meaningful for service types: the top-level marketplace category this
  // subcategory belongs to (category expansion). Empty string -> untyped.
  listingType: z.enum(['SERVICE', 'THERAPY', 'SHOP', 'SCHOOL', 'EVENT', '']).optional(),
});

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// GET — return BOTH taxonomies (including archived) with usage counts, for the admin manager
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [serviceTypes, disabilities] = await Promise.all([
      prisma.serviceType.findMany({
        orderBy: [{ isActive: 'desc' }, { displayOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true, name: true, slug: true, category: true, description: true,
          isActive: true, displayOrder: true, listingType: true,
          _count: { select: { services: true } },
        },
      }),
      prisma.disability.findMany({
        orderBy: [{ isActive: 'desc' }, { displayOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true, name: true, slug: true, category: true, description: true,
          isActive: true, displayOrder: true,
          _count: { select: { businessDisabilities: true, serviceDisabilities: true } },
        },
      }),
    ]);

    return NextResponse.json({ serviceTypes, disabilities });
  } catch (error) {
    console.error('Taxonomy list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — create a new service type or disability
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { kind, name } = parsed.data;
    const slug = parsed.data.slug ? slugify(parsed.data.slug) : slugify(name);
    const data = {
      name,
      slug,
      category: parsed.data.category || null,
      description: parsed.data.description || null,
      displayOrder: parsed.data.displayOrder ?? 0,
    };

    let created: { id: string; name: string };
    try {
      created = kind === 'serviceType'
        ? await prisma.serviceType.create({
            // listingType lives only on ServiceType; '' clears it to null.
            data: { ...data, listingType: parsed.data.listingType ? (parsed.data.listingType as any) : null },
            select: { id: true, name: true },
          })
        : await prisma.disability.create({ data, select: { id: true, name: true } });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return NextResponse.json(
          { error: 'A category with that name or slug already exists' },
          { status: 409 }
        );
      }
      throw err;
    }

    await logAdminAction({
      adminId: session.user.id,
      action: 'CATEGORY_CREATED',
      targetType: kind === 'serviceType' ? 'ServiceType' : 'Disability',
      targetId: created.id,
      targetLabel: created.name,
      metadata: { kind, slug },
    });

    return NextResponse.json({ item: created, message: 'Category created' }, { status: 201 });
  } catch (error) {
    console.error('Taxonomy create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
