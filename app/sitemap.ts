import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { getPublicBaseUrl } from '@/lib/env';
import { BROWSE_CATEGORIES } from '@/lib/listing-taxonomy';

// Regenerate hourly. Providers are approved throughout the day, and a listing that
// is live but absent from the sitemap is invisible to the families searching for it.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getPublicBaseUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/browse`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/search`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/resources`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    ...BROWSE_CATEGORIES.map((c) => ({
      url: `${baseUrl}/browse/${c.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];

  // A database outage must not fail the build or serve an empty sitemap that tells
  // crawlers every listing has vanished — fall back to the static routes instead.
  try {
    const [services, businesses, resources] = await Promise.all([
      // Exactly the visibility rule GET /api/search applies, so the sitemap can
      // never advertise a listing the site would 404 or hide.
      prisma.service.findMany({
        where: {
          isActive: true,
          business: { isActive: true, verificationStatus: 'APPROVED' },
        },
        select: { id: true, updatedAt: true },
        take: 10_000,
      }),
      prisma.business.findMany({
        where: { isActive: true, verificationStatus: 'APPROVED' },
        select: { id: true, updatedAt: true },
        take: 10_000,
      }),
      prisma.resource.findMany({
        where: { isPublished: true },
        select: { slug: true, updatedAt: true },
        take: 10_000,
      }),
    ]);

    return [
      ...staticRoutes,
      ...services.map((s) => ({
        url: `${baseUrl}/listings/${s.id}`,
        lastModified: s.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
      ...businesses.map((b) => ({
        url: `${baseUrl}/business/${b.id}`,
        lastModified: b.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
      ...resources.map((r) => ({
        url: `${baseUrl}/resources/${r.slug}`,
        lastModified: r.updatedAt,
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      })),
    ];
  } catch (error) {
    console.error('Sitemap: could not load dynamic routes, serving static only:', error);
    return staticRoutes;
  }
}
