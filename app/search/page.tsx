import { permanentRedirect } from 'next/navigation';
import { BROWSE_CATEGORIES } from '@/lib/listing-taxonomy';

/**
 * /search has been folded into /browse.
 *
 * The two were the same screen. Both rendered BrowseExperience over the same
 * index, with the same filters, the same tab bar, and the same results — the only
 * difference was that /browse carried the chosen category in the path and /search
 * carried it in a query parameter. That bought nothing and cost plenty: two URLs
 * for one page split whatever ranking the directory earns, gave families two
 * different links to share for identical results, and meant every navigation
 * decision ("does this button go to /search or /browse?") had a wrong answer that
 * still looked right.
 *
 * /browse won because it owns the category routes — /browse/therapies and its
 * siblings are real, prerendered, individually indexable pages that the nav, the
 * homepage grid, and the sitemap all point at. /search had no equivalent.
 *
 * A permanent redirect rather than a deletion: this path is in the sitemap, in
 * bookmarks, in whatever has already been indexed, and in the "Find Services"
 * button people have been clicking since launch. It costs one small file to keep
 * every one of those working, and 308 tells crawlers to move their references.
 */
export default async function SearchRedirectPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;

  // Rebuild the query string, preserving repeated keys (disability, type, age are
  // all multi-select) so a shared /search link keeps every filter it was carrying.
  const params = new URLSearchParams();
  let categorySlug: string | undefined;

  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    // `category` was how /search tracked the listing-type tab. On /browse that is
    // the path segment, so it moves out of the query string entirely.
    if (key === 'category') {
      const slug = Array.isArray(value) ? value[0] : value;
      if (BROWSE_CATEGORIES.some((c) => c.slug === slug)) categorySlug = slug;
      continue;
    }
    for (const v of Array.isArray(value) ? value : [value]) {
      params.append(key, v);
    }
  }

  const qs = params.toString();
  const target = categorySlug ? `/browse/${categorySlug}` : '/browse';
  permanentRedirect(qs ? `${target}?${qs}` : target);
}
