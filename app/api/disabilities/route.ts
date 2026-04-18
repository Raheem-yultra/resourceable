import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const disabilities = await prisma.disability.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({ disabilities });
  } catch (error) {
    console.error('Failed to fetch disabilities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch disabilities' },
      { status: 500 }
    );
  }
}
