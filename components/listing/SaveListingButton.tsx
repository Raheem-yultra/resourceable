'use client';

import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSavedListings } from '@/hooks/use-saved-listings';

/**
 * The save control for the detail page.
 *
 * Result cards have carried a heart for a long time; the page a visitor actually
 * reads before deciding had none — so the one screen where you have enough
 * information to shortlist something was the one screen you could not do it from.
 * Labelled rather than icon-only here, because there is room and no ambiguity
 * about what it applies to.
 */
export function SaveListingButton({
  listingId,
  listingName,
}: {
  listingId: string;
  listingName: string;
}) {
  const { isSaved, toggle } = useSavedListings();
  const saved = isSaved(listingId);

  return (
    <Button
      type="button"
      variant={saved ? 'secondary' : 'outline'}
      size="sm"
      onClick={() => toggle(listingId)}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${listingName} from saved listings` : `Save ${listingName} for later`}
      className="gap-1.5"
    >
      <Heart className={saved ? 'h-4 w-4 fill-destructive text-destructive' : 'h-4 w-4'} aria-hidden="true" />
      {saved ? 'Saved' : 'Save for later'}
    </Button>
  );
}
