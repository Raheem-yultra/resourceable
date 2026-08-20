import type { ListingType } from '@prisma/client';

/**
 * Single source of truth for the category-expansion taxonomy (plan §2.2).
 *
 * The five bookable listing types (Resources are informational and modeled
 * separately) each have a label, an icon key, and a fixed set of seeded
 * subcategories. Seeding (scripts/seed-categories.mjs) creates one ServiceType
 * row per subcategory tagged with its `listingType`; the UI reads these labels
 * for tabs, nav, and the provider "what do you offer?" picker.
 */

export type BookableListingType = 'SERVICE' | 'THERAPY' | 'SHOP' | 'SCHOOL' | 'EVENT';

export interface ListingTypeMeta {
  type: BookableListingType;
  label: string;      // plural, for tabs/nav ("Therapies")
  singular: string;   // for "Add a Therapy listing"
  /** lucide-react icon name, resolved in the client where icons are imported. */
  icon: string;
  /** Route segment under /browse. */
  slug: string;
  /** Whether an age-group filter (incl. 21+) applies (plan §6). */
  hasAgeFilter: boolean;
  /** Whether the age-group / 21+ cross-cut applies to this type (plan §2.3). */
  supportsTwentyOnePlus: boolean;
  subcategories: string[];
}

export const LISTING_TYPES: ListingTypeMeta[] = [
  {
    type: 'SERVICE',
    label: 'Services',
    singular: 'Service',
    icon: 'Stethoscope',
    slug: 'services',
    hasAgeFilter: true,
    supportsTwentyOnePlus: true,
    subcategories: [
      'Barber',
      'Dentist',
      'General Practitioner',
      'Optometrist',
      'Salon / Grooming',
      'Pediatrician',
      'Nutritionist',
      'Home Health Aide',
    ],
  },
  {
    type: 'THERAPY',
    label: 'Therapies',
    singular: 'Therapy',
    icon: 'HeartHandshake',
    slug: 'therapies',
    hasAgeFilter: true,
    supportsTwentyOnePlus: true,
    subcategories: [
      'Speech Therapy',
      'Occupational Therapy',
      'ABA Therapy',
      'Physical Therapy',
      'Behavioral / Counseling',
      'Music Therapy',
      'Art Therapy',
      'Feeding Therapy',
    ],
  },
  {
    type: 'SHOP',
    label: 'Shop',
    singular: 'Product',
    icon: 'ShoppingBag',
    slug: 'shop',
    hasAgeFilter: false,
    supportsTwentyOnePlus: false,
    subcategories: [
      'Mobility Aids',
      'Sensory Tools',
      'Communication Devices (AAC)',
      'Adaptive Clothing',
      'Adaptive Furniture',
      'Safety Equipment',
      'Toys & Learning Aids',
    ],
  },
  {
    type: 'SCHOOL',
    label: 'School',
    singular: 'School / Program',
    icon: 'GraduationCap',
    slug: 'school',
    hasAgeFilter: true,
    supportsTwentyOnePlus: true,
    subcategories: [
      'Special Education Schools',
      'Inclusive / Mainstream Programs',
      'Tutoring & Learning Support',
      'Transition / Life Skills Programs',
      'Vocational Training',
      'Early Intervention Programs',
    ],
  },
  {
    type: 'EVENT',
    label: 'Events',
    singular: 'Event',
    icon: 'CalendarDays',
    slug: 'events',
    hasAgeFilter: true,
    supportsTwentyOnePlus: true,
    subcategories: [
      'Support Groups',
      'Workshops / Training',
      'Camps',
      'Fundraisers',
      'Social / Recreational Meetups',
      'IEP / Advocacy Clinics',
    ],
  },
];

/**
 * Top-level browse categories — what a visitor sees in the nav and the tab bar.
 *
 * Deliberately NOT the same list as LISTING_TYPES. That one is the *provider*
 * taxonomy: what you are creating when you add a listing, and it maps 1:1 to the
 * ListingType enum. This one is the *visitor* taxonomy, and two entries do not
 * correspond to a listing type at all:
 *
 *  - "21+" is an age attribute, not a type. A 21+ speech therapy is still a
 *    Therapy. Modelling it as a ListingType would force each listing into exactly
 *    one of {Therapy, 21+} and silently drop adult therapies out of the Therapies
 *    tab. So it filters every type by age group instead, and correctly appears in
 *    both places.
 *  - "Events & Resources" spans two different models: Events are provider-created
 *    bookable listings (priced, located, in the search index, subject to
 *    verification and billing), while Resources are admin-authored articles with
 *    no provider, price, or location. They are combined for the visitor, who does
 *    not care which table a thing lives in, while staying separate underneath —
 *    merging the data would drag editorial content into the paid provider index.
 *
 * Keeping the two taxonomies separate is what lets the visitor-facing grouping
 * change without a migration or re-tagging a single listing.
 */
export interface BrowseCategory {
  slug: string;
  /** Nav / tab label. */
  label: string;
  /** Heading on the category's own page. */
  title: string;
  subtitle: string;
  /** lucide-react icon name, resolved in the client where icons are imported. */
  icon: string;
  /** Narrow to one listing type, if this category maps to one. */
  listingType?: BookableListingType;
  /** Cross-cutting age filter, for categories that are a facet rather than a type. */
  ageGroup?: 'INFANT' | 'TODDLER' | 'CHILD' | 'TEEN' | 'ADULT';
  /** Also surface the Resources knowledge base on this category. */
  includesResources?: boolean;
}

export const BROWSE_CATEGORIES: BrowseCategory[] = [
  {
    slug: 'services',
    label: 'Services',
    title: 'Services',
    subtitle: 'Everyday services from verified providers near you.',
    icon: 'Stethoscope',
    listingType: 'SERVICE',
  },
  {
    slug: 'therapies',
    label: 'Therapies',
    title: 'Therapies',
    subtitle: 'Speech, occupational, behavioural and other therapies near you.',
    icon: 'HeartHandshake',
    listingType: 'THERAPY',
  },
  {
    slug: 'shop',
    label: 'Shop',
    title: 'Shop',
    subtitle: 'Adaptive equipment, sensory tools, and assistive products.',
    icon: 'ShoppingBag',
    listingType: 'SHOP',
  },
  {
    slug: 'school',
    label: 'School',
    title: 'School',
    subtitle: 'Special education, inclusive programs, tutoring, and transition support.',
    icon: 'GraduationCap',
    listingType: 'SCHOOL',
  },
  {
    slug: 'events-resources',
    label: 'Events & Resources',
    title: 'Events & Resources',
    subtitle:
      'Support groups, workshops and camps to attend — plus free guides, benefits information, and crisis directories.',
    icon: 'CalendarDays',
    listingType: 'EVENT',
    includesResources: true,
  },
  {
    slug: '21-plus',
    label: '21+',
    title: '21+ / Transition-Age',
    subtitle:
      'Adult and transition-age services, therapies, programs, and events across every category.',
    icon: 'UserRound',
    ageGroup: 'ADULT',
  },
];

const BY_CATEGORY_SLUG = new Map(BROWSE_CATEGORIES.map((c) => [c.slug, c]));

export function browseCategoryBySlug(slug: string): BrowseCategory | undefined {
  return BY_CATEGORY_SLUG.get(slug);
}

/**
 * Legacy slugs that used to be their own category, mapped to where they live now.
 * Kept so existing links, bookmarks, and anything already indexed keep working
 * instead of 404-ing.
 */
export const CATEGORY_SLUG_REDIRECTS: Record<string, string> = {
  events: 'events-resources',
};

/** Topic tags for the Resources knowledge base (plan §2.2 / §6). */
export const RESOURCE_TOPICS = [
  'Benefits & Legal Rights',
  'Financial Assistance',
  'Education Rights (IEP/504)',
  'Daily Living Guides',
  'Crisis / Hotline Directory',
  'Insurance Navigation',
] as const;

/** Age-group options for the cross-cutting 21+ filter (plan §2.3). */
export const AGE_GROUP_OPTIONS = [
  { value: '0-5', label: '0–5' },
  { value: '6-12', label: '6–12' },
  { value: '13-20', label: '13–20' },
  { value: '21+', label: '21+' },
] as const;

const BY_TYPE = new Map(LISTING_TYPES.map((t) => [t.type, t]));

export function listingTypeMeta(type: ListingType | BookableListingType): ListingTypeMeta | undefined {
  return BY_TYPE.get(type as BookableListingType);
}

export const VERIFICATION_LEVEL_META: Record<string, { label: string; short: string }> = {
  UNVERIFIED: { label: 'Unverified', short: 'Unverified' },
  BASIC_VERIFIED: { label: 'Verified', short: 'Verified' },
  LICENSED: { label: 'Licensed & Verified', short: 'Licensed' },
};
