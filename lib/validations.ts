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

export const signUpSchema = z.object({
  // Emails are canonically lowercase everywhere (auth lookup, reset, resend all
  // lowercase before querying) — normalize at the entry point so it stays true.
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
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

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const businessProfileSchema = z.object({
  businessName: z.string().min(2, 'Business name is required'),
  description: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
});

// Full business-profile save payload (basic info + the single backing Service).
// Enums are validated against Prisma so a bad value is a 400, not a runtime 500.
export const businessProfileUpdateSchema = z
  .object({
    businessName: z.string().trim().min(2, 'Business name is required and must be at least 2 characters'),
    businessType: z.string().trim().optional(),
    description: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    email: z.union([z.string().email('Invalid email address'), z.literal('')]).optional(),
    website: z.union([z.string().url('Invalid website URL'), z.literal('')]).optional(),
    address: z.string().trim().optional(),
    addressLine2: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    zipCode: z.string().trim().optional(),
    yearEstablished: optionalNumber,
    licenseNumber: z.string().trim().optional(),
    priceRange: z.nativeEnum(PriceRange).default(PriceRange.CONTACT),
    priceMin: optionalNumber,
    priceMax: optionalNumber,
    pricingDetails: z.string().trim().optional(),
    ageGroups: z.array(z.nativeEnum(AgeGroup)).default([]),
    capacity: optionalNumber,
    insuranceAccepted: z.boolean().default(false),
    acceptedInsurances: z.string().optional(),
    serviceTypes: z.array(z.string()).default([]), // disability/service-type slugs
    disabilityTypes: z.array(z.string()).default([]),
    // --- Category-expansion: the backing listing's kind + type-specific fields. ---
    listingType: z.nativeEnum(ListingType).default(ListingType.SERVICE),
    // Selects submit '' when left unset — coerce that to undefined so the enum validates.
    deliveryMode: z
      .union([z.nativeEnum(DeliveryMode), z.literal('')])
      .optional()
      .transform((v) => (v === '' ? undefined : v)),
    // Shop
    condition: z
      .union([z.nativeEnum(ItemCondition), z.literal('')])
      .optional()
      .transform((v) => (v === '' ? undefined : v)),
    isForRent: z.boolean().default(false),
    brand: z.string().trim().max(120).optional(),
    // School
    enrollmentStatus: z.string().trim().max(60).optional(),
    programType: z.string().trim().max(120).optional(),
    gradeLevels: z.array(z.string()).default([]),
    // Event (dates accepted as ISO/date strings from the form; empty allowed)
    startDate: z.string().trim().optional(),
    endDate: z.string().trim().optional(),
    isVirtual: z.boolean().default(false),
  })
  .refine(
    (d) => d.yearEstablished === undefined || (d.yearEstablished >= 1800 && d.yearEstablished <= new Date().getFullYear()),
    { message: 'Invalid year established', path: ['yearEstablished'] }
  )
  .refine((d) => d.priceMin === undefined || d.priceMin >= 0, { message: 'Minimum price cannot be negative', path: ['priceMin'] })
  .refine((d) => d.priceMax === undefined || d.priceMax >= 0, { message: 'Maximum price cannot be negative', path: ['priceMax'] })
  .refine((d) => d.priceMin === undefined || d.priceMax === undefined || d.priceMin <= d.priceMax, {
    message: 'Minimum price cannot exceed maximum price',
    path: ['priceMin'],
  })
  .refine((d) => d.capacity === undefined || d.capacity >= 0, { message: 'Capacity cannot be negative', path: ['capacity'] });

export const serviceSchema = z.object({
  name: z.string().min(2, 'Service name is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  ageGroups: z.array(z.string()).optional(),
  ageMin: z.number().min(0).optional(),
  ageMax: z.number().max(120).optional(),
  priceRange: z.string().optional(),
  priceMin: z.number().optional(),
  priceMax: z.number().optional(),
  insuranceAccepted: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
});

// A single listing (multi-listing marketplace). Providers can create many of these,
// each a different listing type/category. Mirrors the type-specific fields the
// provider listing form collects.
export const listingSchema = z
  .object({
    name: z.string().trim().min(2, 'Listing name is required').max(160),
    description: z.string().trim().min(10, 'Description must be at least 10 characters'),
    listingType: z.nativeEnum(ListingType).default(ListingType.SERVICE),
    serviceTypes: z.array(z.string()).default([]), // subcategory slugs
    ageGroups: z.array(z.nativeEnum(AgeGroup)).default([]),
    priceRange: z.nativeEnum(PriceRange).default(PriceRange.CONTACT),
    priceMin: optionalNumber,
    priceMax: optionalNumber,
    pricingDetails: z.string().trim().optional(),
    capacity: optionalNumber,
    insuranceAccepted: z.boolean().default(false),
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
  .refine((d) => d.priceMin === undefined || d.priceMax === undefined || d.priceMin <= d.priceMax, {
    message: 'Minimum price cannot exceed maximum price',
    path: ['priceMin'],
  });

export const reviewSchema = z.object({
  serviceId: z.string().cuid(),
  rating: z.coerce.number().int().min(1, 'Rating is required').max(5),
  title: z.string().trim().max(120).optional(),
  content: z.string().trim().min(5, 'Please write a short review').max(4000),
});

export const messageSchema = z.object({
  receiverId: z.string().cuid(),
  content: z.string().min(1, 'Message cannot be empty').max(5000),
});

export const searchSchema = z.object({
  query: z.string().optional(),
  zipCode: z.string().optional(),
  disabilityType: z.string().optional(),
  serviceType: z.string().optional(),
  page: z.number().default(1),
  limit: z.number().default(10),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;
export type BusinessProfileUpdateInput = z.infer<typeof businessProfileUpdateSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
