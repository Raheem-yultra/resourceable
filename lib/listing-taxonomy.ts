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

/**
 * Age groups — the single canonical list, matching the `AgeGroup` enum exactly.
 *
 * Both the provider form ("who is this for?") and the visitor filter read from
 * here, so a label can never drift between the two sides. Labels carry the real
 * age span: "Child" alone makes a provider guess where the boundaries are, and a
 * parent of a 13-year-old cannot tell whether "Teen" includes them.
 *
 * ALL_AGES is deliberately not offered as a *filter* option — it is something a
 * provider declares, not something a family searches for. A family searching
 * "Child" wants every listing that serves a child, which includes the all-ages
 * ones; see `ageGroupFilterValues`.
 */
export interface AgeGroupMeta {
  value: 'INFANT' | 'TODDLER' | 'CHILD' | 'TEEN' | 'ADULT' | 'ALL_AGES';
  /** Full label with the age span, for forms and filters. */
  label: string;
  /** Compact label for badges and active-filter pills. */
  short: string;
  /** Offered as a search filter option. */
  filterable: boolean;
}

export const AGE_GROUPS: AgeGroupMeta[] = [
  { value: 'INFANT', label: 'Infant (0–2)', short: 'Infant', filterable: true },
  { value: 'TODDLER', label: 'Toddler (2–5)', short: 'Toddler', filterable: true },
  { value: 'CHILD', label: 'Child (5–12)', short: 'Child', filterable: true },
  { value: 'TEEN', label: 'Teen (12–18)', short: 'Teen', filterable: true },
  { value: 'ADULT', label: 'Adult (18+)', short: 'Adult', filterable: true },
  { value: 'ALL_AGES', label: 'All ages', short: 'All ages', filterable: false },
];

/** The subset offered to families as filter chips. */
export const AGE_GROUP_FILTERS = AGE_GROUPS.filter((a) => a.filterable);

const AGE_BY_VALUE = new Map(AGE_GROUPS.map((a) => [a.value, a]));

export function ageGroupMeta(value: string): AgeGroupMeta | undefined {
  return AGE_BY_VALUE.get(value as AgeGroupMeta['value']);
}

/**
 * Expand a family's age selection into the values a listing may carry to match.
 *
 * A listing tagged ALL_AGES serves a child, so filtering by CHILD must return it
 * — matching only the literal selection would hide every all-ages listing from
 * every age filter, which reads as "no results" rather than "broad availability".
 */
export function ageGroupFilterValues(selected: string[]): string[] {
  if (selected.length === 0) return [];
  return Array.from(new Set([...selected, 'ALL_AGES']));
}

const BY_TYPE = new Map(LISTING_TYPES.map((t) => [t.type, t]));

export function listingTypeMeta(type: ListingType | BookableListingType): ListingTypeMeta | undefined {
  return BY_TYPE.get(type as BookableListingType);
}

export const VERIFICATION_LEVEL_META: Record<string, { label: string; short: string }> = {
  UNVERIFIED: { label: 'Unverified', short: 'Unverified' },
  BASIC_VERIFIED: { label: 'Verified', short: 'Verified' },
  LICENSED: { label: 'Licensed & Verified', short: 'Licensed' },
};
