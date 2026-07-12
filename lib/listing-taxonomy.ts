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

const BY_SLUG = new Map(LISTING_TYPES.map((t) => [t.slug, t]));
const BY_TYPE = new Map(LISTING_TYPES.map((t) => [t.type, t]));

export function listingTypeBySlug(slug: string): ListingTypeMeta | undefined {
  return BY_SLUG.get(slug);
}

export function listingTypeMeta(type: ListingType | BookableListingType): ListingTypeMeta | undefined {
  return BY_TYPE.get(type as BookableListingType);
}

export const VERIFICATION_LEVEL_META: Record<string, { label: string; short: string }> = {
  UNVERIFIED: { label: 'Unverified', short: 'Unverified' },
  BASIC_VERIFIED: { label: 'Verified', short: 'Verified' },
  LICENSED: { label: 'Licensed & Verified', short: 'Licensed' },
};
