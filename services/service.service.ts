import { prisma } from '@/lib/prisma';
import type { z } from 'zod';
import type { listingSchema } from '@/lib/validations';

type ListingData = z.infer<typeof listingSchema>;

function slugifyName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'listing';
}

// Listings are unique per (businessId, slug). Find a free slug for this business,
// optionally ignoring the row being updated.
async function uniqueSlug(businessId: string, name: string, ignoreId?: string): Promise<string> {
  const base = slugifyName(name);
  let slug = base;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await prisma.service.findFirst({
      where: { businessId, slug, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
      select: { id: true },
    });
    if (!clash) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

// Translate a validated listing payload into Service columns (extension fields are
// gated by listing type so we never persist e.g. a Shop condition on an Event).
function buildListingColumns(data: ListingData) {
  const parseDate = (v?: string) => {
    if (!v || !v.trim()) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };
  return {
    shortDescription: data.shortDescription?.trim() || '',
    description: data.description,
    listingType: data.listingType,
    priceRange: data.priceRange,
    priceMin: data.priceMin ?? null,
    priceMax: data.priceMax ?? null,
    pricingDetails: data.pricingDetails?.trim() || null,
    ageGroups: data.ageGroups,
    capacity: data.capacity ?? null,
    duration: data.duration?.trim() || null,
    frequency: data.frequency?.trim() || null,
    // Default to English rather than an empty array: an empty list reads on the
    // public page as "no languages supported" instead of "unspecified".
    languages: data.languages.length > 0 ? data.languages : ['English'],
    insuranceAccepted: data.insuranceAccepted,
    insuranceProviders: data.insuranceAccepted ? data.insuranceProviders : [],
    isAvailable: data.isAvailable,
    deliveryMode: data.deliveryMode ?? null,
    condition: data.listingType === 'SHOP' ? data.condition ?? null : null,
    isForRent: data.listingType === 'SHOP' ? data.isForRent : false,
    brand: data.listingType === 'SHOP' ? data.brand?.trim() || null : null,
    enrollmentStatus: data.listingType === 'SCHOOL' ? data.enrollmentStatus?.trim() || null : null,
    programType: data.listingType === 'SCHOOL' ? data.programType?.trim() || null : null,
    gradeLevels: data.listingType === 'SCHOOL' ? data.gradeLevels : [],
    startDate: data.listingType === 'EVENT' ? parseDate(data.startDate) : null,
    endDate: data.listingType === 'EVENT' ? parseDate(data.endDate) : null,
    isVirtual: data.listingType === 'EVENT' ? data.isVirtual : false,
  };
}

// Re-sync a listing's serviceType (subcategory) mappings to exactly `slugs`.
async function syncServiceTypeMappings(serviceId: string, slugs: string[]) {
  const types =
    slugs.length > 0
      ? await prisma.serviceType.findMany({ where: { slug: { in: slugs } }, select: { id: true } })
      : [];
  // Clear-and-recreate in ONE transaction. Split across two round-trips, a failure
  // in between leaves the listing with no categories at all — invisible to the
  // category filter, and with nothing in the UI to show the save went wrong.
  await prisma.$transaction([
    prisma.serviceTypeMap.deleteMany({ where: { serviceId } }),
    ...(types.length > 0
      ? [
          prisma.serviceTypeMap.createMany({
            data: types.map((t) => ({ serviceId, serviceTypeId: t.id })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);
}

// Re-sync a listing's disability mappings to exactly `slugs`.
//
// These are what the family-facing disability filter matches on — GET /api/search
// narrows with `serviceDisabilities.some(...)`, not the business-level mappings.
// Until the listing form collected them, no provider-created listing could ever
// match a disability filter.
async function syncDisabilityMappings(serviceId: string, slugs: string[]) {
  const disabilities =
    slugs.length > 0
      ? await prisma.disability.findMany({
          where: { slug: { in: slugs } },
          select: { id: true },
        })
      : [];
  // One transaction, for the reason above and more sharply: these rows ARE the
  // disability filter. Losing them between the delete and the create drops the
  // listing out of every disability search while it still looks fine to its owner.
  await prisma.$transaction([
    prisma.serviceDisability.deleteMany({ where: { serviceId } }),
    ...(disabilities.length > 0
      ? [
          prisma.serviceDisability.createMany({
            data: disabilities.map((d) => ({ serviceId, disabilityId: d.id })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);
}

export const serviceService = {
  async getServiceById(id: string) {
    return prisma.service.findUnique({
      relationLoadStrategy: 'join',
      where: { id },
      include: {
        // Explicit select (NOT `include`) so the public GET /api/services/[id]
        // response never leaks PII/internal fields — taxId, adminNotes,
        // licenseNumber, internal review/suspension notes, etc. Only display-safe
        // fields plus userId (needed by the PUT/DELETE ownership check in the
        // route) are returned.
        business: {
          select: {
            id: true,
            userId: true,
            businessName: true,
            businessType: true,
            description: true,
            phone: true,
            email: true,
            website: true,
            address: true,
            addressLine2: true,
            city: true,
            state: true,
            zipCode: true,
            country: true,
            latitude: true,
            longitude: true,
            logo: true,
            coverImage: true,
            yearEstablished: true,
            verificationStatus: true,
            verificationLevel: true,
            isActive: true,
            isFeatured: true,
            hoursOfOperation: true,
            averageRating: true,
            totalReviews: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        serviceTypes: { include: { serviceType: { select: { slug: true, name: true } } } },
        serviceDisabilities: { include: { disability: { select: { slug: true, name: true } } } },
      },
    });
  },

  // --- Multi-listing marketplace: full-fidelity create/update for a single listing. ---
  async createListing(businessId: string, data: ListingData) {
    // Listings inherit the provider's trust tier (denormalized for search).
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { verificationLevel: true },
    });
    const slug = await uniqueSlug(businessId, data.name);
    const service = await prisma.service.create({
      data: {
        businessId,
        name: data.name.trim(),
        slug,
        verificationLevel: business?.verificationLevel ?? 'UNVERIFIED',
        ...buildListingColumns(data),
      },
    });
    await Promise.all([
      syncServiceTypeMappings(service.id, data.serviceTypes),
      syncDisabilityMappings(service.id, data.disabilityTypes),
    ]);
    return service;
  },

  async updateListing(id: string, businessId: string, data: ListingData) {
    const slug = await uniqueSlug(businessId, data.name, id);
    const service = await prisma.service.update({
      where: { id },
      data: { name: data.name.trim(), slug, ...buildListingColumns(data) },
    });
    await Promise.all([
      syncServiceTypeMappings(service.id, data.serviceTypes),
      syncDisabilityMappings(service.id, data.disabilityTypes),
    ]);
    return service;
  },

  // Recompute a listing's rating aggregates from its published reviews.
  async recomputeServiceRating(serviceId: string) {
    const agg = await prisma.review.aggregate({
      where: { serviceId, isPublished: true },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return prisma.service.update({
      where: { id: serviceId },
      data: {
        averageRating: agg._avg.rating ?? null,
        totalReviews: agg._count._all,
      },
    });
  },

  async getServicesByBusinessId(businessId: string) {
    return prisma.service.findMany({
      relationLoadStrategy: 'join',
      where: { businessId },
      include: {
        serviceTypes: { include: { serviceType: { select: { slug: true, name: true } } } },
        serviceDisabilities: { include: { disability: { select: { slug: true, name: true } } } },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  async deleteService(id: string) {
    return prisma.service.delete({
      where: { id },
    });
  },
};
