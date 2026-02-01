import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Validation schema
const searchParamsSchema = z.object({
  query: z.string().optional(),
  zipCode: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  disabilityId: z.string().optional(),
  serviceTypeId: z.string().optional(),
  priceRange: z.enum(['FREE', 'LOW', 'MEDIUM', 'HIGH', 'PREMIUM', 'CONTACT']).optional(),
  ageGroup: z.enum(['INFANT', 'TODDLER', 'CHILD', 'TEEN', 'ADULT', 'ALL_AGES']).optional(),
  insuranceAccepted: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  minRating: z.number().min(1).max(5).optional(),
  radius: z.number().min(1).max(100).optional(), // miles
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(['relevance', 'rating', 'distance', 'price', 'newest']).default('relevance'),
});

type SearchParams = z.infer<typeof searchParamsSchema>;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const session = await getServerSession(authOptions);
    
    // Parse and validate query parameters
    // Handle multiple disability/serviceType IDs
    const disabilityIds = searchParams.getAll('disabilityId');
    const serviceTypeIds = searchParams.getAll('serviceTypeId');
    
    const params = {
      query: searchParams.get('query') || undefined,
      zipCode: searchParams.get('zipCode') || undefined,
      city: searchParams.get('city') || undefined,
      state: searchParams.get('state') || undefined,
      disabilityIds: disabilityIds.length > 0 ? disabilityIds : undefined,
      serviceTypeIds: serviceTypeIds.length > 0 ? serviceTypeIds : undefined,
      priceMin: searchParams.get('priceMin') ? parseFloat(searchParams.get('priceMin')!) : undefined,
      priceMax: searchParams.get('priceMax') ? parseFloat(searchParams.get('priceMax')!) : undefined,
      priceRange: (searchParams.get('priceRange') as 'FREE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'PREMIUM' | 'CONTACT' | undefined) || undefined,
      ageGroup: (searchParams.get('ageGroup') as 'INFANT' | 'TODDLER' | 'CHILD' | 'TEEN' | 'ADULT' | 'ALL_AGES' | undefined) || undefined,
      insuranceAccepted: searchParams.get('insuranceAccepted') === 'true' || undefined,
      isAvailable: searchParams.get('isAvailable') !== 'false',
      minRating: searchParams.get('minRating') ? parseFloat(searchParams.get('minRating')!) : undefined,
      radius: searchParams.get('radius') ? parseInt(searchParams.get('radius')!) : undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      sortBy: (searchParams.get('sortBy') as any) || 'relevance',
    };

    // Build search results
    const results = await searchServices(params, session?.user?.id);

    // Log search for analytics (async, don't wait)
    if (session?.user?.id || params.query) {
      logSearch(params, session?.user?.id, results.pagination.total).catch(console.error);
    }

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Search error:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid search parameters', details: error.errors },
        { status: 400 }
      );
    }

    // Include error message in development/debug
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
        // Temporary: include message to debug production issue
        debug: error.message 
      },
      { status: 500 }
    );
  }
}

// Main search function
async function searchServices(params: any, userId?: string) {
  const { page, limit, sortBy } = params;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: any = {
    isActive: true,
    isAvailable: params.isAvailable !== false,
    business: {
      isActive: true,
      verificationStatus: 'APPROVED',
    },
  };

  // Keyword search (business name, service name, description)
  if (params.query) {
    where.OR = [
      { name: { contains: params.query, mode: 'insensitive' } },
      { description: { contains: params.query, mode: 'insensitive' } },
      { shortDescription: { contains: params.query, mode: 'insensitive' } },
      {
        business: {
          businessName: { contains: params.query, mode: 'insensitive' },
        },
      },
    ];
  }

  // Location filters
  if (params.zipCode) {
    where.business.zipCode = { contains: params.zipCode };
  }
  if (params.city) {
    where.business.city = { contains: params.city, mode: 'insensitive' };
  }
  if (params.state) {
    where.business.state = { equals: params.state, mode: 'insensitive' };
  }

  // Disability filter (using normalized junction table) - Support multiple IDs
  if (params.disabilityIds && params.disabilityIds.length > 0) {
    where.serviceDisabilities = {
      some: {
        disabilityId: {
          in: params.disabilityIds,
        },
      },
    };
  }

  // Service type filter (using normalized junction table) - Support multiple IDs
  if (params.serviceTypeIds && params.serviceTypeIds.length > 0) {
    where.serviceTypes = {
      some: {
        serviceTypeId: {
          in: params.serviceTypeIds,
        },
      },
    };
  }

  // Price range filter (numeric min/max)
  if (params.priceMin !== undefined || params.priceMax !== undefined) {
    where.AND = where.AND || [];
    if (params.priceMin !== undefined) {
      where.AND.push({
        OR: [
          { priceMin: { gte: params.priceMin } },
          { priceMax: { gte: params.priceMin } },
        ],
      });
    }
    if (params.priceMax !== undefined) {
      where.AND.push({
        OR: [
          { priceMin: { lte: params.priceMax } },
          { priceMax: { lte: params.priceMax } },
        ],
      });
    }
  }

  // Price range filter (enum-based)
  if (params.priceRange) {
    where.priceRange = params.priceRange;
  }

  // Age group filter
  if (params.ageGroup) {
    where.ageGroups = {
      has: params.ageGroup,
    };
  }

  // Insurance filter
  if (params.insuranceAccepted) {
    where.insuranceAccepted = true;
  }

  // Rating filter
  if (params.minRating) {
    where.business.averageRating = {
      gte: params.minRating,
    };
  }

  // Build order by clause
  const orderBy = getOrderBy(sortBy);

  // Execute query with relations
  const [services, total] = await Promise.all([
    prisma.service.findMany({
      where,
      include: {
        business: {
          select: {
            id: true,
            userId: true,
            businessName: true,
            city: true,
            state: true,
            zipCode: true,
            address: true,
            phone: true,
            email: true,
            website: true,
            logo: true,
            verificationStatus: true,
            averageRating: true,
            totalReviews: true,
            latitude: true,
            longitude: true,
          },
        },
        serviceDisabilities: {
          include: {
            disability: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        serviceTypes: {
          include: {
            serviceType: {
              select: {
                id: true,
                name: true,
                slug: true,
                category: true,
              },
            },
          },
        },
      },
      skip,
      take: limit,
      orderBy,
    }),
    prisma.service.count({ where }),
  ]);

  // Transform response for cleaner API
  const transformedServices = services.map((service: any) => ({
    id: service.id,
    name: service.name,
    slug: service.slug,
    description: service.description,
    shortDescription: service.shortDescription,
    priceRange: service.priceRange,
    priceMin: service.priceMin,
    priceMax: service.priceMax,
    ageGroups: service.ageGroups,
    insuranceAccepted: service.insuranceAccepted,
    insuranceProviders: service.insuranceProviders,
    languages: service.languages,
    duration: service.duration,
    frequency: service.frequency,
    isAvailable: service.isAvailable,
    business: service.business,
    disabilities: service.serviceDisabilities.map((sd: any) => sd.disability),
    serviceTypes: service.serviceTypes.map((st: any) => st.serviceType),
    createdAt: service.createdAt,
  }));

  return {
    services: transformedServices,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + limit < total,
    },
    filters: {
      applied: getAppliedFilters(params),
    },
  };
}

// Helper: Get order by clause
function getOrderBy(sortBy: SearchParams['sortBy']) {
  switch (sortBy) {
    case 'rating':
      return { business: { averageRating: 'desc' as const } };
    case 'newest':
      return { createdAt: 'desc' as const };
    case 'price':
      return { priceMin: 'asc' as const };
    case 'relevance':
    default:
      return { createdAt: 'desc' as const };
  }
}

// Helper: Get applied filters for response
function getAppliedFilters(params: SearchParams) {
  const applied: string[] = [];
  
  if (params.query) applied.push('keyword');
  if (params.zipCode) applied.push('zipCode');
  if (params.city) applied.push('city');
  if (params.state) applied.push('state');
  if (params.disabilityId) applied.push('disability');
  if (params.serviceTypeId) applied.push('serviceType');
  if (params.priceRange) applied.push('priceRange');
  if (params.ageGroup) applied.push('ageGroup');
  if (params.insuranceAccepted) applied.push('insurance');
  if (params.minRating) applied.push('rating');
  
  return applied;
}

// Helper: Log search for analytics
async function logSearch(params: SearchParams, userId: string | undefined, resultsCount: number) {
  try {
    await prisma.searchHistory.create({
      data: {
        userId,
        query: params.query,
        zipCode: params.zipCode,
        city: params.city,
        state: params.state,
        disabilityId: params.disabilityId,
        serviceTypeId: params.serviceTypeId,
        filters: {
          priceRange: params.priceRange,
          ageGroup: params.ageGroup,
          insuranceAccepted: params.insuranceAccepted,
          minRating: params.minRating,
          sortBy: params.sortBy,
        },
        resultsCount,
      },
    });
  } catch (error) {
    // Silently fail - don't break search if logging fails
    console.error('Failed to log search:', error);
  }
}
