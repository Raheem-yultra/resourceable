import type { Metadata } from 'next';

/**
 * One builder for every public page's metadata.
 *
 * This exists because of a sharp edge in how Next merges metadata: a page that
 * defines its own `openGraph` **replaces** the parent's object outright rather
 * than merging into it. That silently takes three things with it — `siteName`,
 * `locale`, and the image injected by app/opengraph-image.tsx — so the pages that
 * were given the most careful Open Graph titles ended up as the only ones sharing
 * without a picture. A bare URL in a group chat is exactly the link nobody opens,
 * and this site's single most common action is a parent sending a provider to
 * someone else.
 *
 * Hand-writing `images`, `siteName` and `locale` into seven page files would work
 * until the eighth page forgot one. Routing them through here means a page cannot
 * describe itself without also being shareable.
 */

const SITE_NAME = 'ResourceAble';

/**
 * The generated card from app/opengraph-image.tsx.
 *
 * Referenced by path rather than imported: the route serves the PNG that file
 * builds, and naming the route keeps this a plain string that both the Open Graph
 * and Twitter blocks can use. `metadataBase` in the root layout makes it absolute,
 * which the scrapers require.
 */
export const OG_IMAGE = '/opengraph-image';

export interface PageMetaInput {
  title: string;
  description: string;
  /** Site-relative path, used for the canonical and og:url. */
  path: string;
  /** Open Graph object type. 'article' for listings and guides, 'profile' for providers. */
  type?: 'website' | 'article' | 'profile';
  /** Keep this page out of the index (unapproved provider, private page). */
  noindex?: boolean;
  /** Override the share image — a per-listing card, say. Defaults to the site card. */
  image?: string;
}

export function pageMetadata({
  title,
  description,
  path,
  type = 'website',
  noindex = false,
  image = OG_IMAGE,
}: PageMetaInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      type,
      siteName: SITE_NAME,
      locale: 'en_US',
      title,
      description,
      url: path,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

/**
 * Trim a description to something a search result will actually show.
 *
 * Google renders roughly 155–160 characters. Cutting on a word boundary and
 * adding an ellipsis reads as a deliberate summary; a hard slice mid-word reads
 * as a bug, and that is the first impression the page gets to make.
 */
export function truncateDescription(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:—-]+$/, '')}…`;
}
