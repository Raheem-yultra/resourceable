import type { MetadataRoute } from 'next';
import { getPublicBaseUrl } from '@/lib/env';

/**
 * Private areas the crawler has no business in.
 *
 * These are not secrets — every one is enforced server-side by the auth checks in
 * lib/admin.ts, each API route, and proxy.ts. This just keeps them out of the
 * index, where they would only ever produce sign-in redirects.
 */
const PRIVATE_PATHS = [
  '/api/',
  '/admin',
  '/business/dashboard',
  '/business/listings',
  '/business/profile',
  '/messages',
  '/auth/',
  // A shortlist held in the visitor's own browser. There is nothing on the server
  // to render for a crawler, so this can only ever be an empty page.
  '/saved',
];

/**
 * Search-filter parameters, which must not be crawled as separate pages.
 *
 * Moving filter state into the URL is what makes a search shareable — and it also
 * turns one category page into an unbounded number of addresses. ZIP alone is
 * ~40,000 values; multiply by radius, disability, service type, age, verification
 * and sort and the crawlable surface is effectively infinite, every one of them a
 * subset of a page that is already indexed.
 *
 * Two mechanisms, doing different jobs:
 *
 *  - Each browse page declares a canonical pointing at its clean path, which tells
 *    a crawler that already has a filtered URL where the real page lives.
 *  - These rules stop it fetching them in the first place, so crawl budget goes to
 *    listings and providers rather than to permutations.
 *
 * `q` is included deliberately: an internal site-search results page is the
 * canonical example of a URL search engines ask you not to let them index.
 */
const FILTER_PARAMS = [
  'q',
  'zip',
  'miles',
  'disability',
  'type',
  'age',
  'verified',
  'insurance',
  'sort',
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getPublicBaseUrl();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        ...PRIVATE_PATHS,
        // `/*?*name=` matches the parameter anywhere in the query string, not just
        // first — a rule anchored to `?name=` would miss every URL where it is the
        // second filter applied, which is most of them.
        ...FILTER_PARAMS.map((param) => `/*?*${param}=`),
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
