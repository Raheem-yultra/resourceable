import { getPublicBaseUrl } from '@/lib/env';

/**
 * schema.org JSON-LD for the public pages.
 *
 * A directory lives or dies on how its results look in a search page, and the
 * difference between a plain blue link and a result carrying a star rating, a
 * review count, an address and a price range is most of the click. None of that
 * is inferable from the HTML — it has to be declared.
 *
 * The rule running through every builder here: **never emit a field we cannot
 * substantiate.** An `aggregateRating` on a listing with no reviews, an address
 * assembled from blanks, a `priceRange` invented because the field was null — each
 * is a structured-data violation that risks the whole rich result being dropped,
 * and worse, each is a claim the site is making on a provider's behalf that isn't
 * true. So everything optional is conditional, and anything missing is omitted
 * rather than defaulted.
 */

const SITE_NAME = 'ResourceAble';

/** Absolute URL, which JSON-LD requires — relative paths are silently ignored. */
export function absoluteUrl(path: string): string {
  return `${getPublicBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Drop null/undefined/empty values so no builder emits a hollow property. */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => {
      if (v === null || v === undefined || v === '') return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    })
  ) as Partial<T>;
}

/**
 * The site itself, emitted once from the root layout.
 *
 * The `SearchAction` is what can earn a search box directly inside the Google
 * result for the site. It points at /browse because that is now the only search
 * surface — /search is a redirect, and a sitelinks search box aimed at a redirect
 * costs a hop on every use.
 */
export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: absoluteUrl('/'),
    description:
      'Find trusted disability services and support from verified providers in your community.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${absoluteUrl('/browse')}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: absoluteUrl('/'),
    logo: absoluteUrl('/favicon-96x96.png'),
    description: 'A directory of verified disability service providers.',
  };
}

/**
 * Breadcrumb trail. Mirrors the trail rendered on the page — Google's guidance is
 * that structured breadcrumbs should reflect what a visitor can actually see, so
 * these are built from the same array the visible component renders.
 */
export function breadcrumbSchema(trail: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

interface RatingInput {
  averageRating: number | null;
  totalReviews: number;
}

/**
 * `aggregateRating`, or nothing.
 *
 * Google rejects an aggregateRating whose count is zero, and rightly so — it is a
 * rating claim with nothing behind it. Returning undefined lets the caller spread
 * it in unconditionally and have it vanish when there is no rating to show.
 */
function aggregateRating({ averageRating, totalReviews }: RatingInput) {
  if (averageRating == null || totalReviews < 1) return undefined;
  return {
    '@type': 'AggregateRating',
    ratingValue: Number(averageRating.toFixed(1)),
    reviewCount: totalReviews,
    bestRating: 5,
    worstRating: 1,
  };
}

function postalAddress(business: {
  address?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}) {
  const address = compact({
    '@type': 'PostalAddress',
    streetAddress: [business.address, business.addressLine2].filter(Boolean).join(', ') || undefined,
    addressLocality: business.city ?? undefined,
    addressRegion: business.state ?? undefined,
    postalCode: business.zipCode ?? undefined,
    addressCountry: 'US',
  });
  // '@type' and the hardcoded country always survive compact(), so anything with
  // only those two is an address made entirely of blanks. Emit nothing instead.
  return Object.keys(address).length > 2 ? address : undefined;
}

export interface ListingSchemaInput {
  id: string;
  name: string;
  description: string | null;
  shortDescription: string | null;
  listingType: string;
  priceMin: number | null;
  priceMax: number | null;
  averageRating: number | null;
  totalReviews: number;
  images: string[];
  business: {
    id: string;
    businessName: string;
    address?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    phone?: string | null;
    website?: string | null;
  };
  reviews: Array<{
    rating: number;
    title: string | null;
    content: string;
    createdAt: Date;
    user: { name: string | null };
  }>;
}

/**
 * One listing.
 *
 * SHOP listings are modelled as `Product` and everything else as `Service`,
 * because they are genuinely different things and Google treats them differently:
 * a wheelchair cushion has a condition and a price and belongs in shopping
 * results; a speech therapy appointment does not. Calling both "Service" would
 * make the shop invisible to the surface most likely to send it traffic.
 */
export function listingSchema(listing: ListingSchemaInput) {
  const isProduct = listing.listingType === 'SHOP';
  const url = absoluteUrl(`/listings/${listing.id}`);
  const description = listing.shortDescription || listing.description || undefined;
  const rating = aggregateRating(listing);

  // Prices are frequently blank in this directory — providers quote on enquiry.
  // An offer is emitted only when there is a real number behind it.
  const offers =
    listing.priceMin != null
      ? compact({
          '@type': 'Offer',
          price: listing.priceMin,
          priceCurrency: 'USD',
          ...(listing.priceMax != null && listing.priceMax !== listing.priceMin
            ? {
                '@type': 'AggregateOffer',
                lowPrice: listing.priceMin,
                highPrice: listing.priceMax,
                price: undefined,
              }
            : {}),
          availability: 'https://schema.org/InStock',
          url,
        })
      : undefined;

  const provider = compact({
    '@type': 'LocalBusiness',
    '@id': absoluteUrl(`/business/${listing.business.id}#business`),
    name: listing.business.businessName,
    address: postalAddress(listing.business),
    telephone: listing.business.phone ?? undefined,
    url: absoluteUrl(`/business/${listing.business.id}`),
  });

  // Individual reviews power the review snippet. Capped: the payload is downloaded
  // on every page view, and a listing with 200 reviews should not ship all of them.
  const review = listing.reviews.slice(0, 10).map((r) =>
    compact({
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      name: r.title ?? undefined,
      reviewBody: r.content,
      datePublished: r.createdAt.toISOString().slice(0, 10),
      author: { '@type': 'Person', name: r.user.name || 'Verified user' },
    })
  );

  return compact({
    '@context': 'https://schema.org',
    '@type': isProduct ? 'Product' : 'Service',
    '@id': `${url}#listing`,
    name: listing.name,
    description,
    url,
    image: listing.images.length > 0 ? listing.images : undefined,
    ...(isProduct ? { brand: undefined, offers } : { serviceType: listing.listingType, provider, offers }),
    ...(isProduct ? { manufacturer: provider } : {}),
    aggregateRating: rating,
    review: review.length > 0 ? review : undefined,
  });
}

export interface BusinessSchemaInput {
  id: string;
  businessName: string;
  description: string | null;
  address?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logo?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  averageRating: number | null;
  totalReviews: number;
}

/** One provider, as a LocalBusiness — the type that earns a map/knowledge panel. */
export function businessSchema(business: BusinessSchemaInput) {
  const url = absoluteUrl(`/business/${business.id}`);

  const geo =
    business.latitude != null && business.longitude != null
      ? {
          '@type': 'GeoCoordinates',
          latitude: business.latitude,
          longitude: business.longitude,
        }
      : undefined;

  return compact({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${url}#business`,
    name: business.businessName,
    description: business.description ?? undefined,
    url,
    // `sameAs` is for the provider's own site — their canonical presence elsewhere
    // on the web, which is what lets a search engine reconcile the two.
    sameAs: business.website ?? undefined,
    telephone: business.phone ?? undefined,
    email: business.email ?? undefined,
    image: business.logo ?? undefined,
    address: postalAddress(business),
    geo,
    aggregateRating: aggregateRating(business),
  });
}

export interface ResourceSchemaInput {
  slug: string;
  title: string;
  summary: string | null;
  body: string | null;
  topicTags: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** A knowledge-base article. Editorial, authored by the site, no provider. */
export function resourceSchema(resource: ResourceSchemaInput) {
  const url = absoluteUrl(`/resources/${resource.slug}`);
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: resource.title,
    description: resource.summary ?? undefined,
    url,
    keywords: resource.topicTags.length > 0 ? resource.topicTags.join(', ') : undefined,
    datePublished: resource.createdAt.toISOString(),
    dateModified: resource.updatedAt.toISOString(),
    author: { '@type': 'Organization', name: SITE_NAME, url: absoluteUrl('/') },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: absoluteUrl('/favicon-96x96.png') },
    },
  });
}
