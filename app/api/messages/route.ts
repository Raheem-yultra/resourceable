import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit';

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

    // Authenticated, but nothing else caps how fast one account can create rows
    // in another user's inbox. Keyed by user, not IP, so the limit follows the
    // account rather than a shared network.
    const rl = rateLimit(`message:${session.user.id}`, 30, 5 * 60_000);
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

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

/**
 * How many recent messages the conversation list groups over. The grouping is done
 * in memory, so this is the ceiling on what one request can load.
 */
const CONVERSATION_SCAN_LIMIT = 2_000;

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

  // Lean scan: only the fields grouping needs — no per-row user/business joins.
  // Partner details are hydrated afterwards for just the paginated page, which
  // keeps the payload small even as message history grows.
  //
  // Bounded by CONVERSATION_SCAN_LIMIT: grouping happens in application memory, so
  // an unbounded findMany would pull a heavy mailbox's entire history — thousands
  // of 5,000-character bodies — into one serverless invocation. Newest-first
  // ordering means the cap only ever truncates the oldest messages, which affects
  // `totalMessages` on a long-dormant thread and nothing a user is looking at.
  const messages = await prisma.message.findMany({
    where,
    select: {
      id: true,
      senderId: true,
      receiverId: true,
      subject: true,
      content: true,
      status: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: CONVERSATION_SCAN_LIMIT,
  });

  // Group by conversation partner (newest-first, so the first message seen per
  // partner is the conversation's last message).
  const conversationMap = new Map<
    string,
    {
      partnerId: string;
      partner: Record<string, unknown> | null;
      lastMessage: (typeof messages)[number];
      unreadCount: number;
      totalMessages: number;
    }
  >();

  for (const message of messages) {
    const partnerId = message.senderId === userId ? message.receiverId : message.senderId;

    let conversation = conversationMap.get(partnerId);
    if (!conversation) {
      conversation = {
        partnerId,
        partner: null,
        lastMessage: message,
        unreadCount: 0,
        totalMessages: 0,
      };
      conversationMap.set(partnerId, conversation);
    }

    conversation.totalMessages++;

    // Count unread messages where current user is receiver
    if (message.receiverId === userId && message.status !== 'READ') {
      conversation.unreadCount++;
    }
  }

  // Paginate first, then hydrate partner info for only this page in one query.
  const pageConversations = Array.from(conversationMap.values()).slice(skip, skip + limit);
  if (pageConversations.length === 0) return [];

  const partners = await prisma.user.findMany({
    relationLoadStrategy: 'join',
    where: { id: { in: pageConversations.map((c) => c.partnerId) } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      business: { select: { id: true, businessName: true, logo: true } },
    },
  });
  const partnerById = new Map(partners.map((p) => [p.id, p]));

  for (const conversation of pageConversations) {
    const partner = partnerById.get(conversation.partnerId);
    conversation.partner = partner
      ? {
          id: partner.id,
          name: partner.name,
          email: partner.email,
          role: partner.role,
          businessName: partner.business?.businessName,
          businessId: partner.business?.id,
          logo: partner.business?.logo,
        }
      : { id: conversation.partnerId, name: null, email: '', role: 'USER' };
  }

  return pageConversations;
}
