import { z } from 'zod';

export const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  role: z.enum(['USER', 'BUSINESS']).default('USER'),
  zipCode: z.string().optional(),
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
export type ServiceInput = z.infer<typeof serviceSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
