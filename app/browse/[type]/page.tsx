import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { BrowseExperience } from '@/components/search/BrowseExperience';
import { browseCategoryBySlug, CATEGORY_SLUG_REDIRECTS } from '@/lib/listing-taxonomy';
import { pageMetadata } from '@/lib/seo';

// /browse/services, /browse/therapies, /browse/shop, /browse/school,
// /browse/events-resources, /browse/21-plus (plan §5). Unknown slugs 404.

/**
 * Canonical URL for a browse page, always the clean path.
 *
 * Filter state lives in the query string — `?zip=60601&disability=…&sort=distance`
 * — which makes a search shareable but also makes this page infinitely many URLs
 * to a crawler. Every combination of ZIP, radius, disability, service type, age,
 * verification and sort is a distinct address serving a subset of the same
 * listings: textbook faceted-navigation duplicate content, and the fastest way to
 * burn a crawl budget on near-identical pages while the ones that matter go
 * unvisited.
 *
 * Pointing every variant at the bare category path consolidates all of it onto
 * one page per category. robots.ts additionally tells crawlers not to fetch the
 * filtered variants at all, so this is the belt to that pair of braces.
 */
export async function generateMetadata(props: {
  params: Promise<{ type: string }>;
}): Promise<Metadata> {
  const { type } = await props.params;
  const category = browseCategoryBySlug(type);

  // A slug that only exists as a redirect, or not at all, gets nothing indexable —
  // the page itself will redirect or 404 before anyone reads this.
  if (!category) {
    return { title: 'Not found - ResourceAble', robots: { index: false, follow: false } };
  }

  return pageMetadata({
    title: category.seo.title,
    description: category.seo.description,
    path: `/browse/${category.slug}`,
  });
}

export default async function BrowseCategoryPage(props: { params: Promise<{ type: string }> }) {
  const params = await props.params;
  // A slug that used to be its own category (e.g. /browse/events) permanently
  // moves to wherever it lives now, so existing links and bookmarks survive the
  // regrouping instead of 404-ing.
  const moved = CATEGORY_SLUG_REDIRECTS[params.type];
  if (moved) redirect(`/browse/${moved}`);

  const category = browseCategoryBySlug(params.type);
  if (!category) notFound();

  return (
    <BrowseExperience
      title={category.title}
      subtitle={category.subtitle}
      initialCategory={category}
    />
  );
}
