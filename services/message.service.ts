import { prisma } from '@/lib/prisma';

export const messageService = {
  async createMessage(data: {
    senderId: string;
    receiverId: string;
    content: string;
  }) {
    return prisma.message.create({
      data,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  },

  async getConversation(userId1: string, userId2: string) {
    return prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId1, receiverId: userId2 },
          { senderId: userId2, receiverId: userId1 },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  },

  async getUserConversations(userId: string) {
    const messages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Group messages by conversation partner
    const conversationMap = new Map();

    messages.forEach((message) => {
      const partnerId =
        message.senderId === userId ? message.receiverId : message.senderId;
      const partner =
        message.senderId === userId ? message.receiver : message.sender;

      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, {
          partner,
          lastMessage: message,
          unreadCount: 0,
        });
      }

      if (message.receiverId === userId && !message.readAt) {
        conversationMap.get(partnerId).unreadCount++;
      }
    });

    return Array.from(conversationMap.values());
  },

  async markMessagesAsRead(senderId: string, receiverId: string) {
    return prisma.message.updateMany({
      where: {
        senderId,
        receiverId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
  },

  async getUnreadCount(userId: string) {
    return prisma.message.count({
      where: {
        receiverId: userId,
        readAt: null,
      },
    });
  },
};
