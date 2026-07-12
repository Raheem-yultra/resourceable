import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/admin';
import { z } from 'zod';
import { Prisma, AdminActionType } from '@prisma/client';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  action: z.nativeEnum(AdminActionType).optional(),
  targetType: z.enum(['Business', 'ServiceType', 'Disability']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({
      action: searchParams.get('action') || undefined,
      targetType: searchParams.get('targetType') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { action, targetType, page, limit } = parsed.data;
    const where: Prisma.AdminActionWhereInput = {};
    if (action) where.action = action;
    if (targetType) where.targetType = targetType;

    const [actions, total] = await Promise.all([
      prisma.adminAction.findMany({
        relationLoadStrategy: 'join',
        where,
        include: { admin: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.adminAction.count({ where }),
    ]);

    return NextResponse.json({
      actions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Admin audit log error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
