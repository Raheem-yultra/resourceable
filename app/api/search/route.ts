import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ageGroupFilterValues } from '@/lib/listing-taxonomy';
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit';
import { zipCentroid, haversineMiles, boundingBox, type Coordinates } from '@/lib/geo';
import { LISTING_CARD_INCLUDE, toListingCard } from '@/lib/listing-card';

export const dynamic = 'force-dynamic';

// Validation schema
const searchParamsSchema = z.object({
  query: z.string().trim().max(200).optional(),
  zipCode: z.string().trim().max(20).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(50).optional(),
  disabilityIds: z.array(z.string().cuid()).optional(),
  serviceTypeIds: z.array(z.string().cuid()).optional(),
  priceMin: z.number().min(0).max(100000).optional(),
  priceMax: z.number().min(0).max(100000).optional(),
  priceRange: z.enum(['FREE', 'LOW', 'MEDIUM', 'HIGH', 'PREMIUM', 'CONTACT']).optional(),
  // Repeatable: ?ageGroup=CHILD&ageGroup=TEEN. A single value still works, which
  // is what the 21+ browse category sends.
  ageGroups: z.array(z.enum(['INFANT', 'TODDLER', 'CHILD', 'TEEN', 'ADULT', 'ALL_AGES'])).optional(),
  // Category-expansion: restrict to one bookable listing type (browse tabs).
  // Omitted = unified "All" search across every type (plan §5 / §7.1).
  listingType: z.enum(['SERVICE', 'THERAPY', 'SHOP', 'SCHOOL', 'EVENT']).optional(),
  // Only show listings from BASIC_VERIFIED / LICENSED providers.
  verifiedOnly: z.boolean().optional(),
  insuranceAccepted: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  minRating: z.number().min(1).max(5).optional(),
  radius: z.number().int().min(1).max(100).optional(), // miles
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(20),
  // 'distance' is accepted now that lib/geo actually measures it. It still needs a
  // resolvable origin: asked for without one, the response falls back to relevance
  // AND says so in `location`, rather than silently returning a different ordering.
  sortBy: z.enum(['relevance', 'rating', 'price', 'newest', 'distance']).default('relevance'),
}).refine(
  (params) => params.priceMin === undefined || params.priceMax === undefined || params.priceMin <= params.priceMax,
  {
    message: 'priceMin cannot be greater than priceMax',
    path: ['priceMin'],
  }
);

type SearchParams = z.infer<typeof searchParamsSchema>;

/** Matches the filter panel's slider default, so omitting radius means the same thing on both sides. */
const DEFAULT_RADIUS_MILES = 25;

/**
 * Ceiling on rows pulled into memory for the exact-distance pass.
 *
 * A proximity search cannot paginate in SQL: the bounding box is a superset of
 * the circle, so the corner rows have to be measured and dropped before the page
 * boundaries are known. The box already restricts this hard (a 100-mile radius is
 * a small slice of the country), and the cap stops a pathological query from
 * loading the whole table. If it is ever hit, the extra rows were the furthest
 * ones — the least likely to matter for "near me".
 */
const PROXIMITY_SCAN_CAP = 1_000;

export async function GET(req: NextRequest) {
  try {
    // Public and unauthenticated, and every keyword search appends a SearchHistory
    // row — so an unthrottled client can grow that table without ever signing in.
    // The ceiling is high enough that real filter-tweaking never reaches it.
    const rl = rateLimit(`search:${clientIp(req)}`, 120, 60_000);
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const { searchParams } = new URL(req.url);

    // Try to get session, but don't fail if auth is misconfigured
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch (authError) {
      console.warn('Auth session check failed, continuing without session:', authError);
    }
    
    // Parse and validate query parameters
    // Handle multiple disability/serviceType IDs
    const disabilityIds = searchParams.getAll('disabilityId');
    const serviceTypeIds = searchParams.getAll('serviceTypeId');
    const ageGroups = searchParams.getAll('ageGroup');
    const insuranceAcceptedParam = searchParams.get('insuranceAccepted');
    const isAvailableParam = searchParams.get('isAvailable');
    const verifiedOnlyParam = searchParams.get('verifiedOnly');
    const listingTypeParam = searchParams.get('listingType');
    const sortByParam = searchParams.get('sortBy');

    const paramsResult = searchParamsSchema.safeParse({
      query: searchParams.get('query') || undefined,
      zipCode: searchParams.get('zipCode') || undefined,
      city: searchParams.get('city') || undefined,
      state: searchParams.get('state') || undefined,
      disabilityIds: disabilityIds.length > 0 ? disabilityIds : undefined,
      serviceTypeIds: serviceTypeIds.length > 0 ? serviceTypeIds : undefined,
      priceMin: searchParams.get('priceMin') ? parseFloat(searchParams.get('priceMin')!) : undefined,
      priceMax: searchParams.get('priceMax') ? parseFloat(searchParams.get('priceMax')!) : undefined,
      priceRange: (searchParams.get('priceRange') as 'FREE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'PREMIUM' | 'CONTACT' | undefined) || undefined,
      ageGroups: ageGroups.length > 0 ? ageGroups : undefined,
      listingType: (listingTypeParam as 'SERVICE' | 'THERAPY' | 'SHOP' | 'SCHOOL' | 'EVENT' | undefined) || undefined,
      verifiedOnly: verifiedOnlyParam === null ? undefined : verifiedOnlyParam === 'true',
      insuranceAccepted: insuranceAcceptedParam === null ? undefined : insuranceAcceptedParam === 'true',
      isAvailable: isAvailableParam === null ? undefined : isAvailableParam === 'true',
      minRating: searchParams.get('minRating') ? parseFloat(searchParams.get('minRating')!) : undefined,
      radius: searchParams.get('radius') ? parseInt(searchParams.get('radius')!) : undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      sortBy: sortByParam || 'relevance',
    });

    if (!paramsResult.success) {
      return NextResponse.json(
        { error: 'Invalid search parameters', details: paramsResult.error.flatten() },
        { status: 400 }
      );
    }

    const params = paramsResult.data;

    // Build search results
    const results = await searchServices(params, session?.user?.id);

    // Log search for analytics (async, don't wait)
    if (session?.user?.id || params.query) {
      logSearch(params, session?.user?.id, results.pagination.total).catch(console.error);
    }

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Search error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// Main search function
async function searchServices(params: SearchParams, userId?: string) {
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

  // Location filters.
  //
  // A ZIP resolves to a centre (lib/geo) so "within N miles" can mean what it
  // says. When it resolves, the query is narrowed to a bounding box around that
  // centre and the exact circle is trimmed after the fetch; when it does not —
  // no provider in that ZIP has coordinates — we fall back to the old prefix
  // match rather than returning an empty page for a ZIP that simply isn't mapped.
  const origin: Coordinates | null = params.zipCode ? await zipCentroid(params.zipCode) : null;
  const radiusMiles = params.radius ?? DEFAULT_RADIUS_MILES;
  const useProximity = !!origin;

  if (params.zipCode) {
    if (origin) {
      const box = boundingBox(origin, radiusMiles);
      where.business.latitude = { gte: box.minLat, lte: box.maxLat };
      where.business.longitude = { gte: box.minLon, lte: box.maxLon };
    } else {
      where.business.zipCode = { contains: params.zipCode };
    }
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

  // Age group filter. `hasSome` because the selection is a union — a family
  // choosing Child + Teen wants listings serving either. The selection is widened
  // to include ALL_AGES so that a listing declared as serving everyone is not
  // hidden by every age filter (see ageGroupFilterValues).
  if (params.ageGroups && params.ageGroups.length > 0) {
    where.ageGroups = {
      hasSome: ageGroupFilterValues(params.ageGroups),
    };
  }

  // Listing-type filter (browse tabs). Omitted = unified search across all types.
  if (params.listingType) {
    where.listingType = params.listingType;
  }

  // Verified-only filter — providers confirmed at BASIC_VERIFIED or LICENSED.
  if (params.verifiedOnly) {
    where.verificationLevel = { in: ['BASIC_VERIFIED', 'LICENSED'] };
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

  // Build order by clause. `distance` has no SQL expression to sort on — it is
  // computed per row below — so the database sorts by the fallback and the exact
  // ordering is applied after measuring.
  const orderBy = getOrderBy(sortBy === 'distance' ? 'relevance' : sortBy);

  const include = LISTING_CARD_INCLUDE;

  // Proximity searches take a different path: SQL narrows to the bounding box,
  // then the exact circle, the distance ordering, and the page boundaries are all
  // resolved here — because none of the three is knowable until every candidate
  // has actually been measured.
  if (useProximity && origin) {
    const candidates = await prisma.service.findMany({
      relationLoadStrategy: 'join',
      where,
      include,
      take: PROXIMITY_SCAN_CAP,
      orderBy,
    });

    const withDistance = candidates
      .map((service: any) => ({
        service,
        distance:
          service.business?.latitude != null && service.business?.longitude != null
            ? haversineMiles(origin, {
                latitude: service.business.latitude,
                longitude: service.business.longitude,
              })
            : null,
      }))
      // Trim the bounding box's corners back to a true circle.
      .filter((row) => row.distance !== null && row.distance <= radiusMiles);

    if (sortBy === 'distance') {
      withDistance.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    }

    const pageRows = withDistance.slice(skip, skip + limit);

    return buildResponse(
      pageRows.map((row) => ({ ...row.service, __distance: row.distance })),
      withDistance.length,
      params,
      { zipCode: params.zipCode ?? null, radiusMiles, resolved: true, sortedByDistance: sortBy === 'distance' }
    );
  }

  // Execute query with relations. `relationLoadStrategy: 'join'` collapses the
  // main query + every relation into ONE round-trip (LATERAL join) — critical on
  // a remote pooled connection where each extra query adds latency.
  const [services, total] = await Promise.all([
    prisma.service.findMany({
      relationLoadStrategy: 'join',
      where,
      include,
      skip,
      take: limit,
      orderBy,
    }),
    prisma.service.count({ where }),
  ]);

  return buildResponse(services, total, params, {
    zipCode: params.zipCode ?? null,
    radiusMiles: params.zipCode ? radiusMiles : null,
    // A ZIP was given but no provider in it carries coordinates, so "within N
    // miles" could not be honoured. The UI says so instead of quietly showing
    // prefix matches as though they were nearby.
    resolved: false,
    sortedByDistance: false,
  });
}

interface LocationContext {
  zipCode: string | null;
  radiusMiles: number | null;
  resolved: boolean;
  sortedByDistance: boolean;
}

/**
 * Shared response shape for both query paths.
 *
 * Both branches must agree on every field name the client reads, so they share
 * one serializer — the proximity path only adds `distance`, carried in on the
 * private `__distance` key so the transform stays a pure mapping.
 */
function buildResponse(
  services: any[],
  total: number,
  params: SearchParams,
  location: LocationContext
) {
  const { page, limit } = params;
  const skip = (page - 1) * limit;

  const transformedServices = services.map(toListingCard);

  return {
    services: transformedServices,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + limit < total,
    },
    location,
    filters: {
      applied: getAppliedFilters(params),
    },
  };
}

// Helper: Get order by clause
// `relevance` weights provider trust (verification tier) alongside rating so a
// trusted provider isn't outranked purely on recency/proximity (plan §4).
// Enum order is UNVERIFIED < BASIC_VERIFIED < LICENSED, so `desc` surfaces
// LICENSED first.
function getOrderBy(sortBy: SearchParams['sortBy']) {
  switch (sortBy) {
    case 'rating':
      return [{ business: { averageRating: 'desc' as const } }, { verificationLevel: 'desc' as const }];
    case 'newest':
      return { createdAt: 'desc' as const };
    case 'price':
      return { priceMin: 'asc' as const };
    case 'relevance':
    default:
      return [
        { verificationLevel: 'desc' as const },
        { business: { averageRating: 'desc' as const } },
        { createdAt: 'desc' as const },
      ];
  }
}

// Helper: Get applied filters for response
function getAppliedFilters(params: SearchParams) {
  const applied: string[] = [];
  
  if (params.query) applied.push('keyword');
  if (params.zipCode) applied.push('zipCode');
  if (params.city) applied.push('city');
  if (params.state) applied.push('state');
  if (params.disabilityIds?.length) applied.push('disability');
  if (params.serviceTypeIds?.length) applied.push('serviceType');
  if (params.listingType) applied.push('listingType');
  if (params.verifiedOnly) applied.push('verified');
  if (params.priceRange) applied.push('priceRange');
  if (params.ageGroups?.length) applied.push('ageGroup');
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
        disabilityId: params.disabilityIds?.[0],
        serviceTypeId: params.serviceTypeIds?.[0],
        filters: {
          priceRange: params.priceRange,
          ageGroups: params.ageGroups,
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
