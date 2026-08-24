'use client';

import { useState, useMemo } from 'react';
import { useAsyncData } from '@/hooks/use-async-data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Plus, Pencil, Trash2, Loader2, Star, Package, ArrowLeft,
  Stethoscope, HeartHandshake, ShoppingBag, GraduationCap, CalendarDays, AlertTriangle,
} from 'lucide-react';
import { ListingForm } from './ListingForm';
import { LISTING_TYPES } from '@/lib/listing-taxonomy';

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Stethoscope, HeartHandshake, ShoppingBag, GraduationCap, CalendarDays,
};

/**
 * Provider self-service listings manager.
 *
 * A business can create as many listings as it offers, across any mix of
 * categories; each is created/edited via ListingForm and browsed and reviewed by
 * families independently. Listings are grouped by type here so a provider with a
 * dozen of them can still see their catalogue at a glance.
 */
const NO_LISTINGS: any[] = [];

export function ListingsManager() {
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editing, setEditing] = useState<any>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  const {
    data,
    loading,
    reload: load,
  } = useAsyncData<{ services: any[] }>(async (signal) => {
    const res = await fetch('/api/services', { signal });
    if (!res.ok) throw new Error('Failed to load listings');
    return res.json();
  }, []);
  const listings = data?.services ?? NO_LISTINGS;

  // Grouped by listing type, in the taxonomy's own order, so the catalogue reads
  // the same way the family-facing browse tabs do.
  const grouped = useMemo(() => {
    return LISTING_TYPES.map((meta) => ({
      meta,
      items: listings.filter((l) => (l.listingType || 'SERVICE') === meta.type),
    })).filter((g) => g.items.length > 0);
  }, [listings]);

  const onSaved = (wasEdit: boolean) => {
    setMode('list');
    setEditing(null);
    setBlocked(null);
    setNotice(wasEdit ? 'Listing updated.' : 'Listing created.');
    load();
  };

  const startCreate = () => {
    setEditing(null);
    setNotice(null);
    setMode('create');
  };
  const startEdit = (l: any) => {
    setEditing(l);
    setNotice(null);
    setMode('edit');
  };

  const remove = async (l: any) => {
    if (!confirm(`Delete "${l.name}"? This cannot be undone.`)) return;
    setBusyId(l.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/services/${l.id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotice(`"${l.name}" was deleted.`);
        load();
      } else {
        // A lapsed subscription returns 403 here; surfacing it is the difference
        // between "the button is broken" and "I need to fix my card".
        const data = await res.json().catch(() => ({}));
        setBlocked(data.error || 'Could not delete that listing.');
      }
    } finally {
      setBusyId(null);
    }
  };

  if (mode !== 'list') {
    const isEdit = mode === 'edit';
    return (
      <Card>
        <CardHeader>
          <button
            type="button"
            onClick={() => {
              setMode('list');
              setEditing(null);
            }}
            className="mb-2 inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to your listings
          </button>
          <CardTitle>{isEdit ? `Edit “${editing?.name}”` : 'New listing'}</CardTitle>
        </CardHeader>
        <CardContent>
          <ListingForm
            listing={isEdit ? editing : undefined}
            onSaved={() => onSaved(isEdit)}
            onCancel={() => {
              setMode('list');
              setEditing(null);
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            Your listings{listings.length > 0 && <span className="text-muted-foreground"> ({listings.length})</span>}
          </h2>
          <p className="text-sm text-muted-foreground">
            Add one for every service, therapy, product, program, or event you offer — there is no limit.
          </p>
        </div>
        <Button onClick={startCreate} className="min-h-[44px]">
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Add listing
        </Button>
      </div>

      {notice && (
        <div className="theme-success p-3 text-sm" role="status">
          {notice}
        </div>
      )}

      {blocked && (
        <div className="theme-danger flex items-start gap-2 p-3 text-sm" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{blocked}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
        </div>
      ) : listings.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">No listings yet</p>
          <p className="mx-auto mt-1 mb-4 max-w-md text-sm text-muted-foreground">
            A listing is one thing you offer. Most providers start with their main service and add the rest afterwards —
            each one gets its own page, reviews, and search placement.
          </p>
          <Button onClick={startCreate} className="min-h-[44px]">
            <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Create your first listing
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ meta, items }) => {
            const Icon = TYPE_ICONS[meta.icon] || Stethoscope;
            return (
              <section key={meta.type} className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {meta.label}
                  <span className="font-normal">({items.length})</span>
                </h3>
                <div className="space-y-2">
                  {items.map((l) => (
                    <div key={l.id} className="flex items-start justify-between gap-3 rounded-lg border bg-card p-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{l.name}</span>
                          {!l.isAvailable && (
                            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              Not currently available
                            </span>
                          )}
                        </div>
                        {l.shortDescription && (
                          <p className="mt-0.5 truncate text-sm text-muted-foreground">{l.shortDescription}</p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {l.averageRating != null ? (
                            <span className="inline-flex items-center gap-1">
                              <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden="true" />
                              {l.averageRating.toFixed(1)} ({l.totalReviews})
                            </span>
                          ) : (
                            <span>No reviews yet</span>
                          )}
                          {(l.serviceTypes || []).slice(0, 3).map((st: any) => (
                            <span key={st.serviceType?.slug}>{st.serviceType?.name}</span>
                          ))}
                          {(l.ageGroups?.length ?? 0) === 0 && (
                            <span className="text-amber-600 dark:text-amber-400">No ages set — hidden from age filters</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1">
                        <a
                          href={`/listings/${l.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mr-1 text-xs text-primary hover:underline"
                        >
                          View
                        </a>
                        <Button size="sm" variant="ghost" onClick={() => startEdit(l)} aria-label={`Edit ${l.name}`}>
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => remove(l)}
                          disabled={busyId === l.id}
                          aria-label={`Delete ${l.name}`}
                        >
                          {busyId === l.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          <div className="rounded-lg border border-dashed p-4 text-center">
            <Button variant="outline" onClick={startCreate} className="min-h-[44px]">
              <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Add another listing
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
