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
    description: data.description,
    listingType: data.listingType,
    priceRange: data.priceRange,
    priceMin: data.priceMin ?? null,
    priceMax: data.priceMax ?? null,
    pricingDetails: data.pricingDetails?.trim() || null,
    ageGroups: data.ageGroups,
    capacity: data.capacity ?? null,
    insuranceAccepted: data.insuranceAccepted,
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
  await prisma.serviceTypeMap.deleteMany({ where: { serviceId } });
  if (slugs.length === 0) return;
  const types = await prisma.serviceType.findMany({ where: { slug: { in: slugs } }, select: { id: true } });
  if (types.length > 0) {
    await prisma.serviceTypeMap.createMany({
      data: types.map((t) => ({ serviceId, serviceTypeId: t.id })),
      skipDuplicates: true,
    });
  }
}

export const serviceService = {
  async getServiceById(id: string) {
    return prisma.service.findUnique({
      relationLoadStrategy: 'join',
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
        serviceTypes: { include: { serviceType: { select: { slug: true, name: true } } } },
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
    await syncServiceTypeMappings(service.id, data.serviceTypes);
    return service;
  },

  async updateListing(id: string, businessId: string, data: ListingData) {
    const slug = await uniqueSlug(businessId, data.name, id);
    const service = await prisma.service.update({
      where: { id },
      data: { name: data.name.trim(), slug, ...buildListingColumns(data) },
    });
    await syncServiceTypeMappings(service.id, data.serviceTypes);
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
