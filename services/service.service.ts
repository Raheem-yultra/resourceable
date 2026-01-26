import { prisma } from '@/lib/prisma';
import { ServiceType, Disability } from '@prisma/client';

export const serviceService = {
  async createService(businessId: string, data: {
    name: string;
    description: string;
    serviceTypes: ServiceType[];
    disabilityTypes: Disability[];
    ageGroupMin?: number;
    ageGroupMax?: number;
    cost?: string;
    insuranceAccepted?: boolean;
    availableSlots?: boolean;
  }) {
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    return prisma.service.create({
      data: {
        businessId,
        name: data.name,
        description: data.description,
        slug,
        ageGroupMin: data.ageGroupMin,
        ageGroupMax: data.ageGroupMax,
        cost: data.cost,
        insuranceAccepted: data.insuranceAccepted,
        availableSlots: data.availableSlots,
      },
      include: {
        business: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });
  },

  async getServiceById(id: string) {
    return prisma.service.findUnique({
      where: { id },
      include: {
        business: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });
  },

  async getServicesByBusinessId(businessId: string) {
    return prisma.service.findMany({
      where: { businessId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  async updateService(id: string, data: Partial<{
    name: string;
    description: string;
    serviceTypes: ServiceType[];
    disabilityTypes: DisabilityType[];
    ageGroupMin: number;
    ageGroupMax: number;
    cost: string;
    insuranceAccepted: boolean;
    availableSlots: boolean;
  }>) {
    return prisma.service.update({
      where: { id },
      data,
    });
  },

  async deleteService(id: string) {
    return prisma.service.delete({
      where: { id },
    });
  },

  async searchServices(params: {
    query?: string;
    zipCode?: string;
    disabilityType?: DisabilityType;
    serviceType?: ServiceType;
    page?: number;
    limit?: number;
  }) {
    const {
      query,
      zipCode,
      disabilityType,
      serviceType,
      page = 1,
      limit = 10,
    } = params;

    const skip = (page - 1) * limit;

    const where: any = {
      business: {
        verificationStatus: 'APPROVED',
      },
    };

    // Search by name or description
    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        {
          business: {
            businessName: { contains: query, mode: 'insensitive' },
          },
        },
      ];
    }

    // Filter by zipCode
    if (zipCode) {
      where.business = {
        ...where.business,
        zipCode: { contains: zipCode },
      };
    }

    // Filter by disability type
    if (disabilityType) {
      where.disabilityTypes = {
        has: disabilityType,
      };
    }

    // Filter by service type
    if (serviceType) {
      where.serviceTypes = {
        has: serviceType,
      };
    }

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        include: {
          business: {
            select: {
              id: true,
              businessName: true,
              city: true,
              state: true,
              zipCode: true,
              logo: true,
              verificationStatus: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.service.count({ where }),
    ]);

    return {
      services,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
};
