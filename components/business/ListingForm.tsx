'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tag, Stethoscope, HeartHandshake, ShoppingBag, GraduationCap, CalendarDays } from 'lucide-react';
import { LISTING_TYPES, type BookableListingType } from '@/lib/listing-taxonomy';

const LISTING_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Stethoscope, HeartHandshake, ShoppingBag, GraduationCap, CalendarDays,
};
const AGE_GROUPS = [
  { value: 'INFANT', label: 'Infant (0–2)' },
  { value: 'TODDLER', label: 'Toddler (2–5)' },
  { value: 'CHILD', label: 'Child (5–12)' },
  { value: 'TEEN', label: 'Teen (12–18)' },
  { value: 'ADULT', label: 'Adult (18+)' },
  { value: 'ALL_AGES', label: 'All Ages' },
];
const PRICE_RANGES = [
  { value: 'FREE', label: 'Free' },
  { value: 'LOW', label: '$ — Budget' },
  { value: 'MEDIUM', label: '$$ — Moderate' },
  { value: 'HIGH', label: '$$$ — Higher' },
  { value: 'PREMIUM', label: '$$$$ — Premium' },
  { value: 'CONTACT', label: 'Contact for pricing' },
];
const CONDITIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'USED_LIKE_NEW', label: 'Used — like new' },
  { value: 'USED_FAIR', label: 'Used — fair' },
];
const DELIVERY_MODES = [
  { value: 'IN_PERSON', label: 'In-person' },
  { value: 'VIRTUAL', label: 'Virtual' },
  { value: 'BOTH', label: 'In-person or virtual' },
];

export interface ListingFormProps {
  /** Existing listing to edit; omit to create. */
  listing?: any;
  onSaved: () => void;
  onCancel: () => void;
}

const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

/** Create/edit a single listing (multi-listing marketplace). */
export function ListingForm({ listing, onSaved, onCancel }: ListingFormProps) {
  const [serviceTypeOptions, setServiceTypeOptions] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState(() => ({
    name: listing?.name || '',
    description: listing?.description || '',
    listingType: (listing?.listingType || 'SERVICE') as BookableListingType,
    serviceTypes: (listing?.serviceTypes?.map((st: any) => st.serviceType?.slug).filter(Boolean) as string[]) || [],
    ageGroups: (listing?.ageGroups as string[]) || [],
    priceRange: listing?.priceRange || 'CONTACT',
    priceMin: listing?.priceMin != null ? String(listing.priceMin) : '',
    priceMax: listing?.priceMax != null ? String(listing.priceMax) : '',
    pricingDetails: listing?.pricingDetails || '',
    capacity: listing?.capacity != null ? String(listing.capacity) : '',
    insuranceAccepted: listing?.insuranceAccepted || false,
    isAvailable: listing?.isAvailable ?? true,
    deliveryMode: listing?.deliveryMode || '',
    condition: listing?.condition || '',
    isForRent: listing?.isForRent || false,
    brand: listing?.brand || '',
    enrollmentStatus: listing?.enrollmentStatus || '',
    programType: listing?.programType || '',
    gradeLevels: (listing?.gradeLevels as string[]) || [],
    startDate: listing?.startDate ? String(listing.startDate).slice(0, 10) : '',
    endDate: listing?.endDate ? String(listing.endDate).slice(0, 10) : '',
    isVirtual: listing?.isVirtual || false,
  }));

  useEffect(() => {
    fetch('/api/service-types')
      .then((r) => (r.ok ? r.json() : { serviceTypes: [] }))
      .then((d) => setServiceTypeOptions(d.serviceTypes || []))
      .catch(() => {});
  }, []);

  const visibleTypes = useMemo(
    () => serviceTypeOptions.filter((t) => !t.listingType || t.listingType === form.listingType),
    [serviceTypeOptions, form.listingType]
  );
  const activeMeta = LISTING_TYPES.find((t) => t.type === form.listingType);

  const submit = async () => {
    if (form.name.trim().length < 2) return setError('Give your listing a name.');
    if (form.description.trim().length < 10) return setError('Description must be at least 10 characters.');
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      priceMin: form.priceMin === '' ? undefined : Number(form.priceMin),
      priceMax: form.priceMax === '' ? undefined : Number(form.priceMax),
      capacity: form.capacity === '' ? undefined : Number(form.capacity),
    };
    try {
      const url = listing ? `/api/services/${listing.id}` : '/api/services';
      const res = await fetch(url, {
        method: listing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save listing');
      }
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const lt = form.listingType;

  return (
    <div className="space-y-6">
      {/* Type picker */}
      <div>
        <Label className="mb-2 block">Listing type</Label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" role="radiogroup" aria-label="Listing type">
          {LISTING_TYPES.map((t) => {
            const Icon = LISTING_TYPE_ICONS[t.icon] || Tag;
            const selected = lt === t.type;
            return (
              <button
                type="button"
                key={t.type}
                role="radio"
                aria-checked={selected}
                onClick={() => setForm({ ...form, listingType: t.type, serviceTypes: [] })}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center min-h-[72px] ${
                  selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent'
                }`}
              >
                <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <span className="text-xs font-medium">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="l-name">Name *</Label>
          <Input id="l-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Pediatric Speech Therapy" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="l-price-range">Price range</Label>
          <select id="l-price-range" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.priceRange} onChange={(e) => setForm({ ...form, priceRange: e.target.value })}>
            {PRICE_RANGES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="l-desc">Description *</Label>
        <Textarea id="l-desc" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe this listing…" />
      </div>

      {/* Subcategories filtered by type */}
      <div className="space-y-2">
        <Label>{activeMeta ? `${activeMeta.label} categories` : 'Categories'}</Label>
        {visibleTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No categories defined for this type.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {visibleTypes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setForm({ ...form, serviceTypes: toggle(form.serviceTypes, t.slug) })}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  form.serviceTypes.includes(t.slug) ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Age groups */}
      <div className="space-y-2">
        <Label>Age groups</Label>
        <div className="flex flex-wrap gap-2">
          {AGE_GROUPS.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => setForm({ ...form, ageGroups: toggle(form.ageGroups, a.value) })}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                form.ageGroups.includes(a.value) ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pricing numbers */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="l-min">Min price</Label>
          <Input id="l-min" type="number" step="0.01" value={form.priceMin} onChange={(e) => setForm({ ...form, priceMin: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="l-max">Max price</Label>
          <Input id="l-max" type="number" step="0.01" value={form.priceMax} onChange={(e) => setForm({ ...form, priceMax: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="l-cap">Capacity</Label>
          <Input id="l-cap" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
        </div>
      </div>

      {/* Type-specific extension fields */}
      {(lt === 'SERVICE' || lt === 'THERAPY' || lt === 'EVENT') && (
        <div className="space-y-2">
          <Label htmlFor="l-delivery">Delivery format</Label>
          <select id="l-delivery" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.deliveryMode} onChange={(e) => setForm({ ...form, deliveryMode: e.target.value })}>
            <option value="">Not specified</option>
            {DELIVERY_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      )}

      {lt === 'SHOP' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="l-cond">Condition</Label>
              <select id="l-cond" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                <option value="">Not specified</option>
                {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="l-brand">Brand</Label>
              <Input id="l-brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isForRent} onChange={(e) => setForm({ ...form, isForRent: e.target.checked })} />
            Available to rent
          </label>
        </div>
      )}

      {lt === 'SCHOOL' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="l-enroll">Enrollment status</Label>
            <Input id="l-enroll" value={form.enrollmentStatus} onChange={(e) => setForm({ ...form, enrollmentStatus: e.target.value })} placeholder="Open, Waitlist, Closed" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="l-prog">Program type</Label>
            <Input id="l-prog" value={form.programType} onChange={(e) => setForm({ ...form, programType: e.target.value })} />
          </div>
        </div>
      )}

      {lt === 'EVENT' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="l-start">Start date</Label>
              <Input id="l-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="l-end">End date</Label>
              <Input id="l-end" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isVirtual} onChange={(e) => setForm({ ...form, isVirtual: e.target.checked })} />
            Virtual event
          </label>
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.insuranceAccepted} onChange={(e) => setForm({ ...form, insuranceAccepted: e.target.checked })} />
          Insurance accepted
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} />
          Currently available
        </label>
      </div>

      {error && <p className="field-error" role="alert">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : listing ? 'Save listing' : 'Create listing'}</Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </div>
  );
}
