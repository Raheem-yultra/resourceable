'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Archive, RotateCcw, Pencil, Check, X, Tags } from 'lucide-react';

type Kind = 'serviceType' | 'disability';

// Top-level marketplace categories a service-type subcategory can belong to.
const LISTING_TYPE_OPTIONS = [
  { value: '', label: 'Untyped' },
  { value: 'SERVICE', label: 'Services' },
  { value: 'THERAPY', label: 'Therapies' },
  { value: 'SHOP', label: 'Shop' },
  { value: 'SCHOOL', label: 'School' },
  { value: 'EVENT', label: 'Events' },
];
const LISTING_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  LISTING_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

interface TaxonomyItem {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  listingType?: string | null;
  _count: Record<string, number>;
}

function usageCount(item: TaxonomyItem): number {
  return Object.values(item._count || {}).reduce((a, b) => a + b, 0);
}

export function CategoryManager() {
  const [serviceTypes, setServiceTypes] = useState<TaxonomyItem[]>([]);
  const [disabilities, setDisabilities] = useState<TaxonomyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeKind, setActiveKind] = useState<Kind>('serviceType');

  // Create form
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newListingType, setNewListingType] = useState('');
  const [creating, setCreating] = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editListingType, setEditListingType] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/taxonomy');
      if (!res.ok) throw new Error('Failed to load categories');
      const data = await res.json();
      setServiceTypes(data.serviceTypes || []);
      setDisabilities(data.disabilities || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const items = activeKind === 'serviceType' ? serviceTypes : disabilities;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/taxonomy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: activeKind,
          name: newName.trim(),
          category: newCategory.trim() || undefined,
          ...(activeKind === 'serviceType' ? { listingType: newListingType } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create category');
      setNewName('');
      setNewCategory('');
      setNewListingType('');
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/taxonomy/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: activeKind, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (item: TaxonomyItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditCategory(item.category || '');
    setEditListingType(item.listingType || '');
  };

  const saveEdit = async (id: string) => {
    await patch(id, {
      name: editName.trim(),
      category: editCategory.trim() || null,
      ...(activeKind === 'serviceType' ? { listingType: editListingType } : {}),
    });
    setEditingId(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Tags className="h-4 w-4" />
          Category Management
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Add, edit, or archive service types and disabilities without a code deploy. Archived items stay hidden from
          public filters but are preserved for existing listings.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Kind switcher */}
        <div className="flex gap-2 border-b pb-2">
          <Button variant={activeKind === 'serviceType' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveKind('serviceType')}>
            Service Types ({serviceTypes.length})
          </Button>
          <Button variant={activeKind === 'disability' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveKind('disability')}>
            Disabilities ({disabilities.length})
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </div>
        )}

        {/* Create form */}
        <form onSubmit={handleCreate} className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="new-cat-name" className="text-xs">Name</Label>
            <Input id="new-cat-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Occupational Therapy" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-cat-group" className="text-xs">Parent category (optional)</Label>
            <Input id="new-cat-group" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. Therapy" />
          </div>
          {activeKind === 'serviceType' && (
            <div className="space-y-1">
              <Label htmlFor="new-cat-type" className="text-xs">Listing type</Label>
              <select
                id="new-cat-type"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newListingType}
                onChange={(e) => setNewListingType(e.target.value)}
              >
                {LISTING_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-end">
            <Button type="submit" disabled={creating || !newName.trim()} className="w-full sm:w-auto">
              <Plus className="mr-1 h-4 w-4" />
              {creating ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </form>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-11 animate-pulse rounded bg-muted/40" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No categories yet. Add one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Parent</th>
                  {activeKind === 'serviceType' && <th className="py-2 pr-3 font-medium">Type</th>}
                  <th className="py-2 pr-3 font-medium">Usage</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isEditing = editingId === item.id;
                  const busy = busyId === item.id;
                  return (
                    <tr key={item.id} className={`border-b last:border-0 ${!item.isActive ? 'opacity-60' : ''}`}>
                      <td className="py-2 pr-3">
                        {isEditing ? (
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" />
                        ) : (
                          <div>
                            <span className="font-medium">{item.name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{item.slug}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {isEditing ? (
                          <Input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="h-8" placeholder="—" />
                        ) : (
                          <span className="text-muted-foreground">{item.category || '—'}</span>
                        )}
                      </td>
                      {activeKind === 'serviceType' && (
                        <td className="py-2 pr-3">
                          {isEditing ? (
                            <select
                              value={editListingType}
                              onChange={(e) => setEditListingType(e.target.value)}
                              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                            >
                              {LISTING_TYPE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          ) : item.listingType ? (
                            <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              {LISTING_TYPE_LABEL[item.listingType] || item.listingType}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      )}
                      <td className="py-2 pr-3 tabular-nums text-muted-foreground">{usageCount(item)}</td>
                      <td className="py-2 pr-3">
                        {item.isActive ? (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Active</span>
                        ) : (
                          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Archived</span>
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center justify-end gap-1">
                          {isEditing ? (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => saveEdit(item.id)} disabled={busy} aria-label="Save">
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={busy} aria-label="Cancel">
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => startEdit(item)} disabled={busy} aria-label="Edit">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {item.isActive ? (
                                <Button size="sm" variant="ghost" onClick={() => patch(item.id, { isActive: false })} disabled={busy} aria-label="Archive" title="Archive">
                                  <Archive className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" onClick={() => patch(item.id, { isActive: true })} disabled={busy} aria-label="Restore" title="Restore">
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
