import { notFound } from 'next/navigation';
import { BrowseExperience } from '@/components/search/BrowseExperience';
import { browseCategoryBySlug } from '@/lib/listing-taxonomy';

// Cross-category landing for adult / transition-age (post-IDEA) listings (plan §2.3).
// "21+" is an age-range attribute, not a listing type — the category it resolves to
// pre-filters every type by the ADULT age group rather than narrowing to a type of
// its own. Kept as a static route (rather than falling through to /browse/[type])
// so this high-traffic landing page is prerendered; the definition still comes from
// the shared taxonomy, so there is only one source of truth.
export default function TwentyOnePlusPage() {
  const category = browseCategoryBySlug('21-plus');
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
