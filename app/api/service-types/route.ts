import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const serviceTypes = await prisma.serviceType.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        category: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({ serviceTypes });
  } catch (error) {
    console.error('Failed to fetch service types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service types' },
      { status: 500 }
    );
  }
}
