'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Search, Trash2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ServiceList } from '@/components/search/ServiceList';
import { useSavedListings } from '@/hooks/use-saved-listings';

/**
 * The shortlist the heart on every card has been quietly writing to.
 *
 * Saving lives on the device rather than behind an account (see the hook for
 * why), so this page fetches the ids back from the server to render them. Two
 * things follow from that, and both are handled below rather than hidden:
 * listings that have since come down disappear from the shortlist, and the list
 * does not travel between devices.
 */
export function SavedListings() {
  const { saved, hydrated, clear, remove } = useSavedListings();
  const [listings, setListings] = useState<any[]>([]);
  // Starts true and is only ever cleared after the fetch resolves. The "nothing
  // saved" case is *derived* below rather than written here, so this effect makes
  // no synchronous state change — it either fetches or does nothing.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removedCount, setRemovedCount] = useState(0);

  const hasSaved = saved.length > 0;

  useEffect(() => {
    if (!hydrated || !hasSaved) return;

    let cancelled = false;
    const params = new URLSearchParams();
    saved.forEach((id) => params.append('id', id));

    fetch(`/api/listings/batch?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('lookup failed'))))
      .then((data) => {
        if (cancelled) return;
        const found = data.listings || [];
        setListings(found);
        // Anything saved that no longer comes back has been taken down or
        // suspended. Drop it rather than leaving a permanently-missing entry,
        // and say how many went so the change isn't silent.
        const foundIds = new Set(found.map((l: any) => l.id));
        const stale = saved.filter((id) => !foundIds.has(id));
        if (stale.length > 0) {
          setRemovedCount(stale.length);
          stale.forEach(remove);
        }
      })
      .catch(() => {
        if (!cancelled) setError('We could not load your saved listings. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // The id list is the dependency that matters; `remove` is stable from the hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, hasSaved, saved.join(',')]);

  return (
    <div className="min-h-screen">
      <div className="page-wrap">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mb-1 flex items-center gap-2 text-xl font-bold sm:text-2xl lg:text-3xl">
              <Heart className="h-6 w-6 fill-destructive text-destructive" aria-hidden="true" />
              Saved listings
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              {hasSaved
                ? `${saved.length} listing${saved.length === 1 ? '' : 's'} you've saved to compare.`
                : 'Tap the heart on any listing to keep it here while you compare.'}
            </p>
          </div>
          {hasSaved && (
            <Button variant="ghost" size="sm" onClick={clear} className="gap-1.5 text-muted-foreground">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Clear all
            </Button>
          )}
        </div>

        {removedCount > 0 && (
          <div className="theme-note mb-6 flex items-start gap-3 p-4" role="status">
            <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="text-sm">
              {removedCount} saved listing{removedCount === 1 ? ' is' : 's are'} no longer available and{' '}
              {removedCount === 1 ? 'was' : 'were'} removed from this list.
            </p>
          </div>
        )}

        {error && (
          <div className="theme-danger mb-6 p-4" role="alert">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {hydrated && !hasSaved ? (
          <EmptyState
            icon={<Heart className="h-6 w-6" />}
            title="Nothing saved yet"
            description="As you browse, tap the heart on any listing to add it here. Your shortlist stays on this device — no account needed."
            action={
              <Button asChild size="lg">
                <Link href="/browse">
                  <Search className="mr-2 h-4 w-4" aria-hidden="true" />
                  Browse listings
                </Link>
              </Button>
            }
          />
        ) : loading || !hydrated ? (
          <div className="py-12 text-center" role="status">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Loading your saved listings…</p>
          </div>
        ) : listings.length === 0 ? (
          <EmptyState
            icon={<Heart className="h-6 w-6" />}
            title="These listings are no longer available"
            description="Everything you had saved has since been taken down or suspended by its provider."
            action={
              <Button asChild size="lg">
                <Link href="/browse">
                  <Search className="mr-2 h-4 w-4" aria-hidden="true" />
                  Browse listings
                </Link>
              </Button>
            }
          />
        ) : (
          <>
            <ServiceList services={listings} />
            <p className="mt-8 text-xs text-muted-foreground">
              Saved listings are stored on this device only, so they won&apos;t follow you to another phone or
              computer, and clearing your browser data will clear them.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
