import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

interface RouteContext {
  params: { userId: string };
}

const routeParamsSchema = z.object({
  userId: z.string().cuid(),
});

const conversationQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
});

// GET /api/messages/[userId] - Get conversation with specific user
export async function GET(
  req: NextRequest,
  { params }: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const paramsResult = routeParamsSchema.safeParse(params);
    if (!paramsResult.success) {
      return NextResponse.json({ error: 'Invalid conversation user ID' }, { status: 400 });
    }

    const { userId: partnerId } = paramsResult.data;
    const { searchParams } = new URL(req.url);
    const queryResult = conversationQuerySchema.safeParse({
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '50', 10),
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { page, limit } = queryResult.data;
    const skip = (page - 1) * limit;

    // Get conversation between users
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: session.user.id, receiverId: partnerId },
          { senderId: partnerId, receiverId: session.user.id },
        ],
        isArchived: false,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            image: true,
            business: {
              select: {
                id: true,
                businessName: true,
                logo: true,
              },
            },
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            image: true,
            business: {
              select: {
                id: true,
                businessName: true,
                logo: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      skip,
      take: limit,
    });

    // Get total count
    const total = await prisma.message.count({
      where: {
        OR: [
          { senderId: session.user.id, receiverId: partnerId },
          { senderId: partnerId, receiverId: session.user.id },
        ],
        isArchived: false,
      },
    });

    // Mark messages as read (async, don't wait)
    markMessagesAsRead(partnerId, session.user.id).catch(console.error);

    // Get partner info
    const partner = await prisma.user.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        business: {
          select: {
            id: true,
            businessName: true,
            logo: true,
          },
        },
      },
    });

    return NextResponse.json({
      messages,
      partner,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/messages/[userId] - Mark messages as read
export async function PATCH(
  _req: NextRequest,
  { params }: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const paramsResult = routeParamsSchema.safeParse(params);
    if (!paramsResult.success) {
      return NextResponse.json({ error: 'Invalid conversation user ID' }, { status: 400 });
    }

    const { userId: partnerId } = paramsResult.data;

    // Mark all messages from partner as read
    const result = await markMessagesAsRead(partnerId, session.user.id);

    return NextResponse.json({ 
      success: true,
      markedAsRead: result.count,
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/messages/[userId] - Archive conversation
export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const paramsResult = routeParamsSchema.safeParse(params);
    if (!paramsResult.success) {
      return NextResponse.json({ error: 'Invalid conversation user ID' }, { status: 400 });
    }

    const { userId: partnerId } = paramsResult.data;

    // Archive all messages in this conversation
    await prisma.message.updateMany({
      where: {
        OR: [
          { senderId: session.user.id, receiverId: partnerId },
          { senderId: partnerId, receiverId: session.user.id },
        ],
      },
      data: {
        isArchived: true,
      },
    });

    return NextResponse.json({ 
      success: true,
      message: 'Conversation archived',
    });
  } catch (error) {
    console.error('Archive conversation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper: Mark messages as read
async function markMessagesAsRead(senderId: string, receiverId: string) {
  return await prisma.message.updateMany({
    where: {
      senderId,
      receiverId,
      status: { not: 'READ' },
    },
    data: {
      status: 'READ',
      readAt: new Date(),
    },
  });
}
