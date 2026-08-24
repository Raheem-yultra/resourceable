import { notFound, redirect } from 'next/navigation';
import { BrowseExperience } from '@/components/search/BrowseExperience';
import { browseCategoryBySlug, CATEGORY_SLUG_REDIRECTS } from '@/lib/listing-taxonomy';

// /browse/services, /browse/therapies, /browse/shop, /browse/school,
// /browse/events-resources, /browse/21-plus (plan §5). Unknown slugs 404.
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
      syncUrl
    />
  );
}
