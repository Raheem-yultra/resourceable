import { BrowseExperience } from '@/components/search/BrowseExperience';

// Cross-category landing for adult / transition-age (post-IDEA) listings (plan §2.3).
// "21+" is an age-range attribute, not a listing type — so this pre-filters every
// type by the ADULT age group rather than being its own category. A static route
// segment, so it takes precedence over /browse/[type].
export default function TwentyOnePlusPage() {
  return (
    <BrowseExperience
      title="21+ / Transition-Age"
      subtitle="Adult and transition-age services, therapies, programs, and events across every category."
      initialAgeGroup="ADULT"
    />
  );
}
