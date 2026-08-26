import type { Metadata } from 'next';
import { BrowseExperience } from '@/components/search/BrowseExperience';
import { pageMetadata } from '@/lib/seo';

// The site's single search-and-browse surface, type toggle defaulting to "All"
// (plan §5). /search used to render this same component over the same index and
// now permanently redirects here; see app/search/page.tsx for why this is the URL
// that survived.
// Every filter combination is a distinct URL serving a subset of this same page.
// The canonical collapses all of them here; see app/browse/[type]/page.tsx for the
// full reasoning and robots.ts for the crawl-budget half of the fix.
export const metadata: Metadata = pageMetadata({
  title: 'Find Disability Services & Support Near You | ResourceAble',
  description:
    'Search verified disability service providers, therapists, adaptive products, schools and events near you. Filter by disability, age, distance and insurance.',
  path: '/browse',
});

export default function BrowsePage() {
  return (
    <BrowseExperience
      title="Find services and support"
      subtitle="Search verified providers, therapies, products, schools, and events near you."
    />
  );
}
