import type { Prisma } from '@prisma/client';

/**
 * The shape every listing card is rendered from, and the query that produces it.
 *
 * Search and the saved-listings lookup both hand `ServiceList` the same cards, so
 * they have to agree on every field name and every relation loaded. Keeping the
 * include and the transform together here means adding a field to a card is one
 * edit rather than two that can silently drift — the failure mode being a card
 * that renders fine on one route and blank on the other.
 */

export const LISTING_CARD_INCLUDE = {
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
    include: { disability: { select: { id: true, name: true, slug: true } } },
  },
  serviceTypes: {
    include: { serviceType: { select: { id: true, name: true, slug: true, category: true } } },
  },
} satisfies Prisma.ServiceInclude;

/**
 * Flatten a Service row into the card payload.
 *
 * `distance` is carried in on the private `__distance` key by the proximity
 * search path, which is the only caller that has measured one; everywhere else it
 * is null and the card omits the line.
 */
export function toListingCard(service: any) {
  return {
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
    // Category-expansion: listing kind, trust tier, and type-specific fields the
    // card uses to render its badge + secondary info line (plan §7.5).
    listingType: service.listingType,
    verificationLevel: service.verificationLevel,
    deliveryMode: service.deliveryMode,
    condition: service.condition,
    isForRent: service.isForRent,
    brand: service.brand,
    images: service.images,
    enrollmentStatus: service.enrollmentStatus,
    gradeLevels: service.gradeLevels,
    programType: service.programType,
    isVirtual: service.isVirtual,
    rsvpCount: service.rsvpCount,
    capacity: service.capacity,
    startDate: service.startDate,
    endDate: service.endDate,
    // Per-listing rating (multi-listing marketplace) — each listing reviewed on its own.
    averageRating: service.averageRating,
    totalReviews: service.totalReviews,
    // Miles from the searched ZIP, present only on proximity searches. The card
    // has always had a branch for this; until now nothing ever populated it.
    distance: service.__distance ?? null,
    business: service.business,
    disabilities: service.serviceDisabilities.map((sd: any) => sd.disability),
    serviceTypes: service.serviceTypes.map((st: any) => st.serviceType),
    createdAt: service.createdAt,
  };
}

/** The visibility rule every public listing query must apply, in one place. */
export const PUBLICLY_VISIBLE_LISTING = {
  isActive: true,
  business: { isActive: true, verificationStatus: 'APPROVED' as const },
};
