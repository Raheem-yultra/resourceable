import { notFound } from 'next/navigation';
import { BrowseExperience } from '@/components/search/BrowseExperience';
import { listingTypeBySlug } from '@/lib/listing-taxonomy';

// /browse/services, /browse/therapies, /browse/shop, /browse/school, /browse/events
// (plan §5). Unknown slugs 404. Note: /browse/21-plus is a distinct route file.
export default function BrowseTypePage({ params }: { params: { type: string } }) {
  const meta = listingTypeBySlug(params.type);
  if (!meta) notFound();

  return (
    <BrowseExperience
      title={meta.label}
      subtitle={`Browse ${meta.label.toLowerCase()} from verified providers near you.`}
      initialListingType={meta.type}
      syncUrl
    />
  );
}
