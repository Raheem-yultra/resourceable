import { prisma } from '@/lib/prisma';
import { VerificationStatus } from '@prisma/client';

export const businessService = {
  async createBusiness(userId: string, data: {
    businessName: string;
    description?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  }) {
    return prisma.business.create({
      data: {
        userId,
        ...data,
      },
      include: {
        user: true,
      },
    });
  },

  async getBusinessById(id: string) {
    return prisma.business.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        services: true,
      },
    });
  },

  async getBusinessByUserId(userId: string) {
    return prisma.business.findUnique({
      where: { userId },
      include: {
        services: true,
      },
    });
  },

  async updateBusiness(id: string, data: Partial<{
    businessName: string;
    description: string;
    phone: string;
    email: string;
    website: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    logo: string;
  }>) {
    return prisma.business.update({
      where: { id },
      data,
    });
  },

  async updateVerificationStatus(
    id: string,
    status: VerificationStatus,
    metadata?: {
      rejectionReason?: string;
      adminNotes?: string;
      reviewedBy?: string;
    }
  ) {
    const business = await prisma.business.findUnique({
      where: { id },
    });

    if (!business) {
      throw new Error('Business not found');
    }

    return prisma.business.update({
      where: { id },
      data: {
        verificationStatus: status,
        verifiedAt: status === 'APPROVED' ? new Date() : null,
        rejectionReason: metadata?.rejectionReason,
        adminNotes: metadata?.adminNotes,
        reviewedBy: metadata?.reviewedBy,
        reviewedAt: new Date(),
      },
    });
  },

  async getBusinessesByStatus(status: VerificationStatus) {
    return prisma.business.findMany({
      where: {
        verificationStatus: status,
      },
      select: {
        id: true,
        businessName: true,
        businessType: true,
        description: true,
        email: true,
        phone: true,
        website: true,
        address: true,
        addressLine2: true,
        city: true,
        state: true,
        zipCode: true,
        yearEstablished: true,
        licenseNumber: true,
        verificationStatus: true,
        createdAt: true,
        verifiedAt: true,
        rejectionReason: true,
        adminNotes: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
          },
        },
        services: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        businessDisabilities: {
          include: {
            disability: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  },

  async getPendingBusinesses() {
    return this.getBusinessesByStatus('PENDING');
  },

  async getAllBusinesses(filters?: {
    verificationStatus?: VerificationStatus;
  }) {
    return prisma.business.findMany({
      where: filters,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        services: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },
};
