import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { isProviderActionBlocked } from '@/lib/billing';

// Validation schemas
const sendMessageSchema = z.object({
  receiverId: z.string().cuid(),
  subject: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(1).max(5000),
  parentId: z.string().cuid().optional(),
});

const conversationsQuerySchema = z.object({
  type: z.enum(['all', 'sent', 'received']).default('all'),
  unreadOnly: z.boolean().default(false),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(20),
});

// GET /api/messages - Get user's conversations
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const queryResult = conversationsQuerySchema.safeParse({
      type: searchParams.get('type') || undefined,
      unreadOnly: searchParams.get('unreadOnly') === 'true',
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '20', 10),
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { type, unreadOnly, page, limit } = queryResult.data;
    const skip = (page - 1) * limit;

    // Get all conversations grouped by conversation partner
    const conversations = await getConversations(
      session.user.id,
      type,
      unreadOnly,
      skip,
      limit
    );

    // Get unread count
    const unreadCount = await prisma.message.count({
      where: {
        receiverId: session.user.id,
        status: { not: 'READ' },
        isArchived: false,
      },
    });

    return NextResponse.json({
      conversations,
      unreadCount,
      pagination: {
        page,
        limit,
        hasMore: conversations.length === limit,
      },
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/messages - Send a new message
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // A provider whose billing has lapsed (suspended/canceled) can't respond to
    // inquiries. Families (USER) are never blocked.
    if (session.user.role === 'BUSINESS' && (await isProviderActionBlocked(session.user.id))) {
      return NextResponse.json(
        { error: 'Your subscription is inactive. Reactivate billing to send messages.', code: 'BILLING_INACTIVE' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = sendMessageSchema.parse(body);

    if (validatedData.receiverId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot send a message to yourself' },
        { status: 400 }
      );
    }

    // Check if receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: validatedData.receiverId },
      select: { id: true, email: true, name: true },
    });

    if (!receiver) {
      return NextResponse.json(
        { error: 'Receiver not found' },
        { status: 404 }
      );
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        senderId: session.user.id,
        receiverId: validatedData.receiverId,
        subject: validatedData.subject,
        content: validatedData.content,
        parentId: validatedData.parentId,
        status: 'SENT',
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error: any) {
    console.error('Send message error:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to get conversations
async function getConversations(
  userId: string,
  type: string,
  unreadOnly: boolean,
  skip: number,
  limit: number
) {
  // Build where clause based on type
  let where: any = {
    isArchived: false,
  };

  if (type === 'sent') {
    where.senderId = userId;
  } else if (type === 'received') {
    where.receiverId = userId;
  } else {
    // All conversations
    where.OR = [
      { senderId: userId },
      { receiverId: userId },
    ];
  }

  if (unreadOnly) {
    where.receiverId = userId;
    where.status = { not: 'READ' };
  }

  // Get all messages for this user
  const messages = await prisma.message.findMany({
    relationLoadStrategy: 'join',
    where,
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
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
      createdAt: 'desc',
    },
  });

  // Group by conversation partner
  const conversationMap = new Map();

  messages.forEach((message: any) => {
    const partnerId = message.senderId === userId ? message.receiverId : message.senderId;
    const partner = message.senderId === userId ? message.receiver : message.sender;

    if (!conversationMap.has(partnerId)) {
      conversationMap.set(partnerId, {
        partnerId,
        partner: {
          id: partner.id,
          name: partner.name,
          email: partner.email,
          role: partner.role,
          businessName: partner.business?.businessName,
          businessId: partner.business?.id,
          logo: partner.business?.logo,
        },
        lastMessage: message,
        unreadCount: 0,
        totalMessages: 0,
      });
    }

    const conversation = conversationMap.get(partnerId);
    conversation.totalMessages++;

    // Count unread messages where current user is receiver
    if (message.receiverId === userId && message.status !== 'READ') {
      conversation.unreadCount++;
    }
  });

  // Convert to array and apply pagination
  return Array.from(conversationMap.values())
    .slice(skip, skip + limit);
}
