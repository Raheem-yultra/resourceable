import { BrowseExperience } from '@/components/search/BrowseExperience';

// /search is the unified "All types" browse experience. The dedicated
// /browse/<type> routes render the same component pre-scoped to one listing type.
export default function SearchPage() {
  return <BrowseExperience title="Find Special Needs Services" />;
}
