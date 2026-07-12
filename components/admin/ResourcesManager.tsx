'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BookOpen, Loader2, Pencil, Trash2, Plus } from 'lucide-react';
import { RESOURCE_TOPICS } from '@/lib/listing-taxonomy';

interface Resource {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  body: string;
  topicTags: string[];
  resourceType: 'ARTICLE' | 'GUIDE' | 'HOTLINE' | 'FORM';
  externalUrl: string | null;
  isPublished: boolean;
  displayOrder: number;
}

const TYPES = ['ARTICLE', 'GUIDE', 'HOTLINE', 'FORM'] as const;

const EMPTY = {
  title: '', summary: '', body: '', topicTags: [] as string[],
  resourceType: 'ARTICLE' as Resource['resourceType'], externalUrl: '', isPublished: true, displayOrder: 0,
};

export function ResourcesManager() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/resources');
      if (res.ok) setResources((await res.json()).resources || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setForm({ ...EMPTY }); setEditingId(null); setError(''); };

  const startEdit = (r: Resource) => {
    setEditingId(r.id);
    setForm({
      title: r.title, summary: r.summary || '', body: r.body, topicTags: r.topicTags,
      resourceType: r.resourceType, externalUrl: r.externalUrl || '', isPublished: r.isPublished, displayOrder: r.displayOrder,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleTag = (tag: string) =>
    setForm((f) => ({ ...f, topicTags: f.topicTags.includes(tag) ? f.topicTags.filter((t) => t !== tag) : [...f.topicTags, tag] }));

  const save = async () => {
    if (form.title.trim().length < 2 || form.body.trim().length < 1) {
      setError('Title and body are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const url = editingId ? `/api/admin/resources/${editingId}` : '/api/admin/resources';
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      resetForm();
      await load();
    } catch (e: any) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (r: Resource) => {
    await fetch(`/api/admin/resources/${r.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublished: !r.isPublished }),
    });
    load();
  };

  const remove = async (r: Resource) => {
    if (!confirm(`Delete "${r.title}"? This cannot be undone.`)) return;
    await fetch(`/api/admin/resources/${r.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-6">
      {/* Editor */}
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          {editingId ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
          <h2 className="text-lg font-semibold">{editingId ? 'Edit resource' : 'New resource'}</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="r-title">Title *</Label>
            <Input id="r-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-type">Type</Label>
            <select
              id="r-type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.resourceType}
              onChange={(e) => setForm({ ...form, resourceType: e.target.value as Resource['resourceType'] })}
            >
              {TYPES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="r-summary">Summary</Label>
          <Input id="r-summary" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="One-line description shown on the card" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="r-body">Body *</Label>
          <Textarea id="r-body" rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Full content. Line breaks are preserved." />
        </div>

        <div className="space-y-2">
          <Label>Topics</Label>
          <div className="flex flex-wrap gap-2">
            {RESOURCE_TOPICS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  form.topicTags.includes(t) ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="r-url">External URL (optional)</Label>
            <Input id="r-url" value={form.externalUrl} onChange={(e) => setForm({ ...form, externalUrl: e.target.value })} placeholder="https://…" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-order">Display order</Label>
            <Input id="r-order" type="number" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
          Published (visible on /resources)
        </label>

        {error && <p className="field-error" role="alert">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create resource'}</Button>
          {editingId && <Button variant="outline" onClick={resetForm} disabled={saving}>Cancel</Button>}
        </div>
      </div>

      {/* List */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Resources ({resources.length})</h2>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : resources.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No resources yet. Create one above.</p>
        ) : (
          <div className="space-y-2">
            {resources.map((r) => (
              <div key={r.id} className="rounded-lg border bg-card p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{r.title}</span>
                    <span className="text-xs text-muted-foreground">{r.resourceType.toLowerCase()}</span>
                    {!r.isPublished && <span className="rounded-full bg-muted text-muted-foreground border border-border px-2 py-0.5 text-xs">Draft</span>}
                  </div>
                  {r.topicTags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.topicTags.map((t) => <span key={t} className="text-xs text-muted-foreground">#{t}</span>)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => togglePublish(r)}>{r.isPublished ? 'Unpublish' : 'Publish'}</Button>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(r)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(r)} aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
