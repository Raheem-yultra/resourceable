'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Tag, Stethoscope, HeartHandshake, ShoppingBag, GraduationCap, CalendarDays,
  DollarSign, Users, Info,
} from 'lucide-react';
import { LISTING_TYPES, AGE_GROUPS, type BookableListingType } from '@/lib/listing-taxonomy';

const LISTING_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Stethoscope, HeartHandshake, ShoppingBag, GraduationCap, CalendarDays,
};
// Age groups come from the shared taxonomy so the provider's options and the
// family's filter chips can never drift apart.
const PRICE_RANGES = [
  { value: 'FREE', label: 'Free' },
  { value: 'LOW', label: '$ — Budget (under $50)' },
  { value: 'MEDIUM', label: '$$ — Moderate ($50–$150)' },
  { value: 'HIGH', label: '$$$ — Higher ($150–$300)' },
  { value: 'PREMIUM', label: '$$$$ — Premium ($300+)' },
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
const ENROLLMENT_STATUSES = ['Open', 'Waitlist', 'Closed'];
const COMMON_LANGUAGES = ['English', 'Spanish', 'ASL', 'Mandarin', 'Arabic', 'French', 'Tagalog', 'Vietnamese'];

/** Placeholder that shows a provider what a good name looks like for their type. */
const NAME_PLACEHOLDERS: Record<BookableListingType, string> = {
  SERVICE: 'e.g. Sensory-friendly haircuts',
  THERAPY: 'e.g. Pediatric speech therapy',
  SHOP: 'e.g. Weighted compression vest',
  SCHOOL: 'e.g. K–5 inclusive day program',
  EVENT: 'e.g. Saturday parent support group',
};

export interface ListingFormProps {
  /** Existing listing to edit; omit to create. */
  listing?: any;
  onSaved: () => void;
  onCancel: () => void;
}

const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

/**
 * Create or edit one listing.
 *
 * A provider has as many of these as they have things to offer; each is browsed,
 * filtered, and reviewed independently. The form is grouped into four plain
 * questions — what kind of thing, what it is, who it is for, what it costs — so a
 * provider adding their fifth listing can move through it without re-reading.
 */
const NO_FIELD_ERRORS: Record<string, string> = {};
const FIX_FIELDS_MESSAGE = 'Please fix the highlighted fields.';

export function ListingForm({ listing, onSaved, onCancel }: ListingFormProps) {
  const [serviceTypeOptions, setServiceTypeOptions] = useState<any[]>([]);
  const [disabilityOptions, setDisabilityOptions] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const [form, setForm] = useState(() => ({
    name: listing?.name || '',
    shortDescription: listing?.shortDescription || '',
    description: listing?.description || '',
    listingType: (listing?.listingType || 'SERVICE') as BookableListingType,
    serviceTypes: (listing?.serviceTypes?.map((st: any) => st.serviceType?.slug).filter(Boolean) as string[]) || [],
    disabilityTypes:
      (listing?.serviceDisabilities?.map((sd: any) => sd.disability?.slug).filter(Boolean) as string[]) || [],
    ageGroups: (listing?.ageGroups as string[]) || [],
    priceRange: listing?.priceRange || 'CONTACT',
    priceMin: listing?.priceMin != null ? String(listing.priceMin) : '',
    priceMax: listing?.priceMax != null ? String(listing.priceMax) : '',
    pricingDetails: listing?.pricingDetails || '',
    capacity: listing?.capacity != null ? String(listing.capacity) : '',
    duration: listing?.duration || '',
    frequency: listing?.frequency || '',
    languages: (listing?.languages as string[]) || ['English'],
    insuranceAccepted: listing?.insuranceAccepted || false,
    insuranceProviders: (listing?.insuranceProviders as string[]) || [],
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

  // Free-text entry for insurers, kept out of `form` so the comma-separated string
  // the provider is mid-way through typing never round-trips through the array.
  const [insuranceText, setInsuranceText] = useState<string>(
    ((listing?.insuranceProviders as string[]) || []).join(', ')
  );

  useEffect(() => {
    Promise.all([
      fetch('/api/service-types').then((r) => (r.ok ? r.json() : { serviceTypes: [] })),
      fetch('/api/disabilities').then((r) => (r.ok ? r.json() : { disabilities: [] })),
    ])
      .then(([types, dis]) => {
        setServiceTypeOptions(types.serviceTypes || []);
        setDisabilityOptions(dis.disabilities || []);
      })
      .catch(() => {});
  }, []);

  const visibleTypes = useMemo(
    () => serviceTypeOptions.filter((t) => !t.listingType || t.listingType === form.listingType),
    [serviceTypeOptions, form.listingType]
  );
  const activeMeta = LISTING_TYPES.find((t) => t.type === form.listingType);
  const lt = form.listingType;

  const validate = (data: typeof form): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (data.name.trim().length < 2) errs['l-name'] = 'Give your listing a name.';
    if (data.name.trim().length > 160) errs['l-name'] = 'Keep the name under 160 characters.';
    if (data.shortDescription.length > 200) errs['l-short'] = 'Keep the summary under 200 characters.';
    if (data.description.trim().length < 10) errs['l-desc'] = 'Describe this listing in at least 10 characters.';
    const min = data.priceMin === '' ? undefined : Number(data.priceMin);
    const max = data.priceMax === '' ? undefined : Number(data.priceMax);
    if (min !== undefined && (Number.isNaN(min) || min < 0)) errs['l-min'] = 'Enter a price of 0 or more.';
    if (max !== undefined && (Number.isNaN(max) || max < 0)) errs['l-max'] = 'Enter a price of 0 or more.';
    if (min !== undefined && max !== undefined && !Number.isNaN(min) && !Number.isNaN(max) && min > max) {
      errs['l-min'] = 'Minimum price cannot exceed the maximum.';
    }
    const cap = data.capacity === '' ? undefined : Number(data.capacity);
    if (cap !== undefined && (Number.isNaN(cap) || cap < 0)) errs['l-cap'] = 'Enter a whole number of 0 or more.';
    if (data.listingType === 'EVENT' && data.startDate && data.endDate && data.endDate < data.startDate) {
      errs['l-end'] = 'The end date cannot be before the start date.';
    }
    return errs;
  };

  // Derived, never stored. The effect that mirrored these into state re-rendered
  // the whole form a second time on every keystroke just to arrive at the same
  // answer validate() already gives during render.
  const fieldErrors = hasSubmitted ? validate(form) : NO_FIELD_ERRORS;

  // Drop the summary banner once the last field is fixed — leaving "please fix the
  // highlighted fields" up when nothing is highlighted any more reads as a form
  // that will not let you through.
  const visibleError =
    error === FIX_FIELDS_MESSAGE && Object.keys(fieldErrors).length === 0 ? '' : error;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setHasSubmitted(true);

    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setError(FIX_FIELDS_MESSAGE);
      document.getElementById(Object.keys(errs)[0])?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSaving(true);
    const payload = {
      ...form,
      priceMin: form.priceMin === '' ? undefined : Number(form.priceMin),
      priceMax: form.priceMax === '' ? undefined : Number(form.priceMax),
      capacity: form.capacity === '' ? undefined : Number(form.capacity),
      insuranceProviders: insuranceText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
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

  const err = (id: string) =>
    fieldErrors[id] ? (
      <p className="field-error" role="alert">
        {fieldErrors[id]}
      </p>
    ) : null;
  const invalid = (id: string) => (fieldErrors[id] ? 'border-destructive' : '');

  const chip = (selected: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
      selected
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-border bg-card text-muted-foreground hover:text-foreground'
    }`;

  return (
    <form onSubmit={submit} className="space-y-8" noValidate>
      {/* 1 — What kind of thing is this? */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">1. What are you listing?</h3>
          <p className="text-xs text-muted-foreground">
            This decides where families browse to find it, and which details we ask for below.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Listing type">
          {LISTING_TYPES.map((t) => {
            const Icon = LISTING_TYPE_ICONS[t.icon] || Tag;
            const selected = lt === t.type;
            return (
              <button
                type="button"
                key={t.type}
                role="radio"
                aria-checked={selected}
                // Switching type clears subcategory picks so we never persist a
                // cross-type mapping (e.g. a Shop item tagged "Speech Therapy").
                onClick={() => setForm({ ...form, listingType: t.type, serviceTypes: [] })}
                className={`flex min-h-[76px] flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors ${
                  selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent'
                }`}
              >
                <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <span className="text-xs font-medium">{t.singular}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2 — What is it? */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">2. Describe it</h3>
          <p className="text-xs text-muted-foreground">What a family reads on the search card and the listing page.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="l-name">Name *</Label>
          <Input
            id="l-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={NAME_PLACEHOLDERS[lt]}
            aria-invalid={!!fieldErrors['l-name']}
            className={invalid('l-name')}
          />
          {err('l-name')}
        </div>

        <div className="space-y-2">
          <Label htmlFor="l-short">One-line summary</Label>
          <Input
            id="l-short"
            value={form.shortDescription}
            onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
            placeholder="The single line that appears on search results"
            maxLength={200}
            aria-invalid={!!fieldErrors['l-short']}
            className={invalid('l-short')}
            aria-describedby="l-short-help"
          />
          {err('l-short') || (
            <p id="l-short-help" className="text-xs text-muted-foreground">
              {200 - form.shortDescription.length} characters left.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="l-desc">Full description *</Label>
          <Textarea
            id="l-desc"
            rows={5}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What happens, what is included, and what a family should expect…"
            aria-invalid={!!fieldErrors['l-desc']}
            className={invalid('l-desc')}
          />
          {err('l-desc')}
        </div>

        <div className="space-y-2">
          <Label>{activeMeta ? `${activeMeta.label} categories` : 'Categories'}</Label>
          <p className="text-xs text-muted-foreground">Pick every category this fits — families browse by these.</p>
          {visibleTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories defined for this type.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {visibleTypes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={form.serviceTypes.includes(t.slug)}
                  onClick={() => setForm({ ...form, serviceTypes: toggle(form.serviceTypes, t.slug) })}
                  className={chip(form.serviceTypes.includes(t.slug))}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 3 — Who is it for? */}
      <section className="space-y-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4" aria-hidden="true" /> 3. Who is it for?
          </h3>
          <p className="text-xs text-muted-foreground">
            These two are what the family-facing filters match on. A listing with neither set will not appear when
            someone narrows by age or by need.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Ages served</Label>
          <div className="flex flex-wrap gap-2">
            {AGE_GROUPS.map((a) => (
              <button
                key={a.value}
                type="button"
                aria-pressed={form.ageGroups.includes(a.value)}
                onClick={() => setForm({ ...form, ageGroups: toggle(form.ageGroups, a.value) })}
                className={chip(form.ageGroups.includes(a.value))}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Disabilities and needs supported</Label>
          {disabilityOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {disabilityOptions.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={form.disabilityTypes.includes(d.slug)}
                  onClick={() => setForm({ ...form, disabilityTypes: toggle(form.disabilityTypes, d.slug) })}
                  className={chip(form.disabilityTypes.includes(d.slug))}
                >
                  {d.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Languages offered</Label>
          <div className="flex flex-wrap gap-2">
            {COMMON_LANGUAGES.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={form.languages.includes(l)}
                onClick={() => setForm({ ...form, languages: toggle(form.languages, l) })}
                className={chip(form.languages.includes(l))}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 4 — Practical details, type-specific */}
      <section className="space-y-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <DollarSign className="h-4 w-4" aria-hidden="true" /> 4. Cost and availability
          </h3>
          <p className="text-xs text-muted-foreground">
            Leave anything you would rather discuss directly on &ldquo;Contact for pricing&rdquo;.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="l-price-range">Price range</Label>
          <select
            id="l-price-range"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.priceRange}
            onChange={(e) => {
              const next = e.target.value;
              // Free / contact-for-pricing hides the amount fields, so drop any
              // numbers already typed rather than persisting a price on a listing
              // that publicly claims to have none.
              const clears = next === 'CONTACT' || next === 'FREE';
              setForm({
                ...form,
                priceRange: next,
                priceMin: clears ? '' : form.priceMin,
                priceMax: clears ? '' : form.priceMax,
              });
            }}
          >
            {PRICE_RANGES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {form.priceRange !== 'CONTACT' && form.priceRange !== 'FREE' && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="l-min">Lowest price</Label>
              <Input
                id="l-min"
                type="number"
                step="0.01"
                min="0"
                placeholder="50.00"
                value={form.priceMin}
                onChange={(e) => setForm({ ...form, priceMin: e.target.value })}
                aria-invalid={!!fieldErrors['l-min']}
                className={invalid('l-min')}
              />
              {err('l-min')}
            </div>
            <div className="space-y-2">
              <Label htmlFor="l-max">Highest price</Label>
              <Input
                id="l-max"
                type="number"
                step="0.01"
                min="0"
                placeholder="150.00"
                value={form.priceMax}
                onChange={(e) => setForm({ ...form, priceMax: e.target.value })}
                aria-invalid={!!fieldErrors['l-max']}
                className={invalid('l-max')}
              />
              {err('l-max')}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="l-pricing-details">Pricing notes</Label>
          <Textarea
            id="l-pricing-details"
            rows={2}
            placeholder="Packages, sliding scale, deposit, or anything else families should know"
            value={form.pricingDetails}
            onChange={(e) => setForm({ ...form, pricingDetails: e.target.value })}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="l-duration">Session length</Label>
            <Input
              id="l-duration"
              placeholder="e.g. 45 minutes"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="l-frequency">How often</Label>
            <Input
              id="l-frequency"
              placeholder="e.g. Twice weekly"
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="l-cap">Spaces available</Label>
            <Input
              id="l-cap"
              type="number"
              min="0"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              aria-invalid={!!fieldErrors['l-cap']}
              className={invalid('l-cap')}
            />
            {err('l-cap')}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border p-3">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.insuranceAccepted}
              onChange={(e) => setForm({ ...form, insuranceAccepted: e.target.checked })}
            />
            <span>
              <span className="font-medium">Insurance accepted</span>
              <span className="block text-xs text-muted-foreground">Families can filter for this.</span>
            </span>
          </label>
          {form.insuranceAccepted && (
            <div className="space-y-2">
              <Label htmlFor="l-insurers">Which insurers?</Label>
              <Input
                id="l-insurers"
                placeholder="Blue Cross, Aetna, Medicaid"
                value={insuranceText}
                onChange={(e) => setInsuranceText(e.target.value)}
                aria-describedby="l-insurers-help"
              />
              <p id="l-insurers-help" className="text-xs text-muted-foreground">
                Separate each with a comma.
              </p>
            </div>
          )}
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.isAvailable}
              onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })}
            />
            <span>
              <span className="font-medium">Currently available</span>
              <span className="block text-xs text-muted-foreground">
                Uncheck to keep the listing but mark it as not taking new families right now.
              </span>
            </span>
          </label>
        </div>

        {/* Type-specific extension fields */}
        {(lt === 'SERVICE' || lt === 'THERAPY' || lt === 'EVENT') && (
          <div className="space-y-2">
            <Label htmlFor="l-delivery">Delivery format</Label>
            <select
              id="l-delivery"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.deliveryMode}
              onChange={(e) => setForm({ ...form, deliveryMode: e.target.value })}
            >
              <option value="">Not specified</option>
              {DELIVERY_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {lt === 'SHOP' && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="l-cond">Condition</Label>
                <select
                  id="l-cond"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.condition}
                  onChange={(e) => setForm({ ...form, condition: e.target.value })}
                >
                  <option value="">Not specified</option>
                  {CONDITIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="l-brand">Brand</Label>
                <Input
                  id="l-brand"
                  placeholder="e.g. Tobii Dynavox"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isForRent}
                onChange={(e) => setForm({ ...form, isForRent: e.target.checked })}
              />
              Offered as a rental rather than a sale
            </label>
          </div>
        )}

        {lt === 'SCHOOL' && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="l-enroll">Enrollment status</Label>
                <select
                  id="l-enroll"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.enrollmentStatus}
                  onChange={(e) => setForm({ ...form, enrollmentStatus: e.target.value })}
                >
                  <option value="">Not specified</option>
                  {ENROLLMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="l-prog">Program type</Label>
                <Input
                  id="l-prog"
                  placeholder="e.g. Day school, After-school"
                  value={form.programType}
                  onChange={(e) => setForm({ ...form, programType: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="l-grades">Grade levels</Label>
              <Input
                id="l-grades"
                placeholder="K, 1, 2, 3"
                value={form.gradeLevels.join(', ')}
                onChange={(e) =>
                  setForm({
                    ...form,
                    gradeLevels: e.target.value.split(',').map((g) => g.trim()).filter(Boolean),
                  })
                }
                aria-describedby="l-grades-help"
              />
              <p id="l-grades-help" className="text-xs text-muted-foreground">
                Separate each with a comma.
              </p>
            </div>
          </div>
        )}

        {lt === 'EVENT' && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="l-start">Start date</Label>
                <Input
                  id="l-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="l-end">End date</Label>
                <Input
                  id="l-end"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  aria-invalid={!!fieldErrors['l-end']}
                  className={invalid('l-end')}
                />
                {err('l-end')}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isVirtual}
                onChange={(e) => setForm({ ...form, isVirtual: e.target.checked })}
              />
              Attendees join online
            </label>
          </div>
        )}
      </section>

      {visibleError && (
        <p className="field-error" role="alert">
          {visibleError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Button type="submit" disabled={saving} className="min-h-[44px]">
          {saving ? 'Saving…' : listing ? 'Save changes' : 'Create listing'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving} className="min-h-[44px]">
          Cancel
        </Button>
        {!listing && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            You can add more listings straight after this one.
          </p>
        )}
      </div>
    </form>
  );
}
