import type { MetadataRoute } from 'next';
import { getPublicBaseUrl } from '@/lib/env';

/**
 * Crawlers are welcome on the public directory and nowhere else.
 *
 * The disallowed paths are not secrets — every one of them is enforced server-side
 * by the auth checks in lib/admin.ts, each API route, and proxy.ts. This just keeps
 * them out of the index, where they would only ever produce sign-in redirects.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = getPublicBaseUrl();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin', '/business/dashboard', '/business/listings', '/business/profile', '/messages', '/auth/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
