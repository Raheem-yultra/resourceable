import { z } from 'zod';
import { PriceRange, AgeGroup, ListingType, DeliveryMode, ItemCondition } from '@prisma/client';

// Phone number validation helper
const phoneRegex = /^(\+1)?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;

// Coerce optional numeric form fields (sent as strings, may be empty) to number | undefined
const optionalNumber = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((v) => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isNaN(n) ? undefined : n;
  });

/**
 * The one password rule, shared by signup and password reset. Kept separate so the
 * two paths cannot drift: a reset that accepted what signup rejects is a policy
 * that only looks enforced.
 *
 * The upper bound matters as much as the lower one — bcrypt only consumes the
 * first 72 bytes, so anything beyond it is hashing work the server does for nothing.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be 72 characters or fewer');

export const signUpSchema = z.object({
  // Emails are canonically lowercase everywhere (auth lookup, reset, resend all
  // lowercase before querying) — normalize at the entry point so it stays true.
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: passwordSchema,
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  role: z.enum(['USER', 'BUSINESS']).default('USER'),
  zipCode: z.string().optional(),
  phone: z.string().optional(),
}).refine((data) => {
  // Phone is required for BUSINESS accounts
  if (data.role === 'BUSINESS') {
    if (!data.phone || data.phone.trim() === '') {
      return false;
    }
    return phoneRegex.test(data.phone);
  }
  // Phone is optional for USER accounts, but must be valid if provided
  if (data.phone && data.phone.trim() !== '') {
    return phoneRegex.test(data.phone);
  }
  return true;
}, {
  message: 'Valid phone number is required for business accounts',
  path: ['phone'],
}).refine((data) => {
  // Zip is required for BUSINESS accounts (drives location visibility in search)
  if (data.role === 'BUSINESS') {
    return !!data.zipCode && /^\d{5}$/.test(data.zipCode.trim());
  }
  return true;
}, {
  message: 'A valid 5-digit zip code is required for business accounts',
  path: ['zipCode'],
});

// Full business-profile save payload.
//
// This describes the PROVIDER ONLY — identity, contact, location, credentials,
// hours, and the disabilities they serve. It deliberately carries no listing
// fields (price, age groups, listing type, ...): those belong to `listingSchema`
// and a provider may have many listings. Merging the two is what previously let a
// profile save silently overwrite the provider's first listing.
export const businessProfileUpdateSchema = z
  .object({
    businessName: z.string().trim().min(2, 'Business name is required and must be at least 2 characters'),
    businessType: z.string().trim().optional(),
    description: z.string().trim().min(10, 'Tell families what you do — at least 10 characters'),
    phone: z.string().trim().min(1, 'Phone number is required').regex(phoneRegex, 'Enter a valid US phone number'),
    email: z.string().trim().email('Enter a valid email address'),
    website: z.union([z.string().url('Website must start with http:// or https://'), z.literal('')]).optional(),
    address: z.string().trim().min(1, 'Street address is required'),
    addressLine2: z.string().trim().optional(),
    city: z.string().trim().min(1, 'City is required'),
    state: z.string().trim().length(2, 'Use the 2-letter state code'),
    zipCode: z.string().trim().regex(/^\d{5}$/, 'Enter a valid 5-digit ZIP code'),
    yearEstablished: optionalNumber,
    licenseNumber: z.string().trim().optional(),
    // Structured (unlike the free-text licenseNumber) so it can be matched against the
    // public NPPES registry. Accept spaces/dashes as typed and normalize to 10 digits;
    // the CMS check digit is validated in lib/verification, not here, so a typo surfaces
    // to the admin as a failed check rather than blocking the provider's own save.
    npi: z
      .union([z.string().trim(), z.literal('')])
      .optional()
      .transform((v) => {
        const digits = (v ?? '').replace(/\D/g, '');
        return digits.length > 0 ? digits : undefined;
      })
      .refine((v) => v === undefined || v.length === 10, 'NPI must be 10 digits'),
    taxId: z
      .union([z.string().trim(), z.literal('')])
      .optional()
      .transform((v) => (v && v.trim() ? v.trim() : undefined)),
    // Who this provider serves, at the organisation level. Per-listing disabilities
    // are set on each listing (they drive search); this is the business-wide summary
    // shown on the provider's public page.
    disabilityTypes: z.array(z.string()).default([]),
    // Day -> hours string ("9:00 AM – 5:00 PM" / "Closed"). Stored as Json because
    // the public page renders it as day/value pairs. Days the provider left blank
    // are omitted entirely rather than stored as empty strings.
    hoursOfOperation: z
      .record(z.string().trim().max(60))
      .optional()
      .transform((v) => {
        if (!v) return undefined;
        const entries = Object.entries(v).filter(([, hours]) => hours.trim().length > 0);
        return entries.length > 0 ? Object.fromEntries(entries) : undefined;
      }),
  })
  .refine(
    (d) => d.yearEstablished === undefined || (d.yearEstablished >= 1800 && d.yearEstablished <= new Date().getFullYear()),
    { message: 'Invalid year established', path: ['yearEstablished'] }
  );

// A single listing (multi-listing marketplace). Providers can create many of these,
// each a different listing type/category. Mirrors the type-specific fields the
// provider listing form collects.
export const listingSchema = z
  .object({
    name: z.string().trim().min(2, 'Listing name is required').max(160),
    // The one line that appears on a search result card. Capped to match the
    // VarChar(200) column so an over-long value is a 400, not a Postgres error.
    shortDescription: z.string().trim().max(200, 'Keep the summary under 200 characters').optional(),
    description: z.string().trim().min(10, 'Description must be at least 10 characters'),
    listingType: z.nativeEnum(ListingType).default(ListingType.SERVICE),
    serviceTypes: z.array(z.string()).default([]), // subcategory slugs
    // Per-listing disabilities served. These, not the business-level ones, are what
    // the family-facing disability filter matches on (see app/api/search).
    disabilityTypes: z.array(z.string()).default([]),
    ageGroups: z.array(z.nativeEnum(AgeGroup)).default([]),
    priceRange: z.nativeEnum(PriceRange).default(PriceRange.CONTACT),
    priceMin: optionalNumber,
    priceMax: optionalNumber,
    pricingDetails: z.string().trim().optional(),
    capacity: optionalNumber,
    duration: z.string().trim().max(80).optional(),
    frequency: z.string().trim().max(80).optional(),
    languages: z.array(z.string().trim().min(1)).default([]),
    insuranceAccepted: z.boolean().default(false),
    insuranceProviders: z.array(z.string().trim().min(1)).default([]),
    isAvailable: z.boolean().default(true),
    // Type-specific extension fields ('' selects coerce to undefined).
    deliveryMode: z
      .union([z.nativeEnum(DeliveryMode), z.literal('')])
      .optional()
      .transform((v) => (v === '' ? undefined : v)),
    condition: z
      .union([z.nativeEnum(ItemCondition), z.literal('')])
      .optional()
      .transform((v) => (v === '' ? undefined : v)),
    isForRent: z.boolean().default(false),
    brand: z.string().trim().max(120).optional(),
    enrollmentStatus: z.string().trim().max(60).optional(),
    programType: z.string().trim().max(120).optional(),
    gradeLevels: z.array(z.string()).default([]),
    startDate: z.string().trim().optional(),
    endDate: z.string().trim().optional(),
    isVirtual: z.boolean().default(false),
  })
  .refine((d) => d.priceMin === undefined || d.priceMin >= 0, {
    message: 'Minimum price cannot be negative',
    path: ['priceMin'],
  })
  .refine((d) => d.priceMax === undefined || d.priceMax >= 0, {
    message: 'Maximum price cannot be negative',
    path: ['priceMax'],
  })
  .refine((d) => d.priceMin === undefined || d.priceMax === undefined || d.priceMin <= d.priceMax, {
    message: 'Minimum price cannot exceed maximum price',
    path: ['priceMin'],
  })
  .refine((d) => d.capacity === undefined || d.capacity >= 0, {
    message: 'Capacity cannot be negative',
    path: ['capacity'],
  })
  // An event that ends before it starts is a data-entry slip that would otherwise
  // surface to families as a listing that can never be attended.
  .refine(
    (d) => {
      if (d.listingType !== 'EVENT' || !d.startDate || !d.endDate) return true;
      const start = new Date(d.startDate);
      const end = new Date(d.endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return true;
      return end >= start;
    },
    { message: 'End date cannot be before the start date', path: ['endDate'] }
  );

export type ListingInput = z.infer<typeof listingSchema>;

export const reviewSchema = z.object({
  serviceId: z.string().cuid(),
  rating: z.coerce.number().int().min(1, 'Rating is required').max(5),
  title: z.string().trim().max(120).optional(),
  content: z.string().trim().min(5, 'Please write a short review').max(4000),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type BusinessProfileUpdateInput = z.infer<typeof businessProfileUpdateSchema>;
