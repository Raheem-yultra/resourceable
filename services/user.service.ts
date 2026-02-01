import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';

export const userService = {
  async createUser(data: {
    email: string;
    password: string;
    name?: string;
    role?: UserRole;
    phone?: string;
    emailVerificationToken?: string;
    emailVerificationExpiry?: Date;
  }) {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: data.role || 'USER',
        phone: data.phone,
        emailVerificationToken: data.emailVerificationToken,
        emailVerificationExpiry: data.emailVerificationExpiry,
      },
    });

    return user;
  },

  async getUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        business: true,
      },
    });
  },

  async getUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        business: true,
      },
    });
  },

  async updateUser(id: string, data: { name?: string; email?: string }) {
    return prisma.user.update({
      where: { id },
      data,
    });
  },
};
