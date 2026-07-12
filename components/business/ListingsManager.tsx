'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Plus, Pencil, Trash2, Loader2, Star, Package,
  Stethoscope, HeartHandshake, ShoppingBag, GraduationCap, CalendarDays,
} from 'lucide-react';
import { ListingForm } from './ListingForm';
import { listingTypeMeta } from '@/lib/listing-taxonomy';

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Stethoscope, HeartHandshake, ShoppingBag, GraduationCap, CalendarDays,
};

/**
 * Provider self-service listings manager (multi-listing marketplace). A business
 * can create many listings across different categories; each is created/edited via
 * ListingForm and can be reviewed independently by families.
 */
export function ListingsManager() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editing, setEditing] = useState<any>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/services');
      if (res.ok) setListings((await res.json()).services || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onSaved = () => { setMode('list'); setEditing(null); setBlocked(null); load(); };

  const startCreate = () => { setEditing(null); setMode('create'); };
  const startEdit = (l: any) => { setEditing(l); setMode('edit'); };

  const remove = async (l: any) => {
    if (!confirm(`Delete "${l.name}"? This cannot be undone.`)) return;
    setBusyId(l.id);
    try {
      const res = await fetch(`/api/services/${l.id}`, { method: 'DELETE' });
      if (res.ok) load();
    } finally {
      setBusyId(null);
    }
  };

  if (mode !== 'list') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{mode === 'edit' ? 'Edit listing' : 'New listing'}</CardTitle>
        </CardHeader>
        <CardContent>
          <ListingForm
            listing={mode === 'edit' ? editing : undefined}
            onSaved={onSaved}
            onCancel={() => { setMode('list'); setEditing(null); }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Your listings</h2>
          <p className="text-sm text-muted-foreground">Add a listing for each service, product, program, or event you offer.</p>
        </div>
        <Button onClick={startCreate}><Plus className="mr-1 h-4 w-4" /> Add listing</Button>
      </div>

      {blocked && <p className="field-error" role="alert">{blocked}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : listings.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-4">You have no listings yet.</p>
          <Button onClick={startCreate}><Plus className="mr-1 h-4 w-4" /> Create your first listing</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {listings.map((l) => {
            const meta = listingTypeMeta(l.listingType || 'SERVICE');
            const Icon = meta ? TYPE_ICONS[meta.icon] || Stethoscope : Stethoscope;
            return (
              <div key={l.id} className="rounded-lg border bg-card p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {meta?.singular || 'Listing'}
                    </span>
                    <span className="font-medium">{l.name}</span>
                    {!l.isAvailable && <span className="rounded-full bg-muted text-muted-foreground border border-border px-2 py-0.5 text-xs">Unavailable</span>}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    {l.averageRating != null ? (
                      <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-primary text-primary" /> {l.averageRating.toFixed(1)} ({l.totalReviews})</span>
                    ) : (
                      <span>No reviews yet</span>
                    )}
                    {(l.serviceTypes || []).slice(0, 2).map((st: any) => (
                      <span key={st.serviceType?.slug}>{st.serviceType?.name}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <a href={`/listings/${l.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mr-1">View</a>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(l)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(l)} disabled={busyId === l.id} aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
