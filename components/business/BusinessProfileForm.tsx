'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Building2, MapPin, Phone, Mail, Globe, Clock, CheckCircle, ShieldCheck,
  HeartHandshake, ArrowRight, Info,
} from 'lucide-react';
import { HoursOfOperationEditor, type HoursValue } from './HoursOfOperationEditor';

/**
 * Everything about the PROVIDER — and nothing about what they sell.
 *
 * This form used to also edit a hidden "first listing" (price, age groups, listing
 * type), which meant saving an address change could rename and overwrite a real
 * listing the provider had created. Listings now live entirely in
 * /business/listings, and the form says so at the bottom so nobody goes looking
 * for pricing here.
 */

interface FilterOption {
  id: string;
  name: string;
  slug: string;
  category?: string;
}

interface BusinessProfileFormProps {
  business: any;
  userId: string;
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM',
  'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
  'WV', 'WI', 'WY',
];

const PHONE_RE = /^(\+1)?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The order these appear in the form. Used for the "jump to section" rail and to
// scroll to the first section that still has an error.
const SECTIONS = [
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' },
  { id: 'location', label: 'Location' },
  { id: 'credentials', label: 'Verification' },
  { id: 'who', label: 'Who you serve' },
  { id: 'hours', label: 'Hours' },
] as const;

const NO_FIELD_ERRORS: Record<string, string> = {};
const FIX_FIELDS_MESSAGE = 'Please fix the highlighted fields before saving.';

export function BusinessProfileForm({ business, userId }: BusinessProfileFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Disability options come from the DB so their slugs match what the API expects.
  const [availableDisabilities, setAvailableDisabilities] = useState<FilterOption[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/disabilities')
      .then((r) => (r.ok ? r.json() : { disabilities: [] }))
      .then((d) => setAvailableDisabilities(d.disabilities || []))
      .catch(() => {})
      .finally(() => setOptionsLoaded(true));
  }, []);

  const [formData, setFormData] = useState({
    businessName: business?.businessName || '',
    businessType: business?.businessType || '',
    description: business?.description || '',
    phone: business?.phone || '',
    email: business?.email || '',
    website: business?.website || '',
    address: business?.address || '',
    addressLine2: business?.addressLine2 || '',
    city: business?.city || '',
    state: business?.state || '',
    zipCode: business?.zipCode || '',
    yearEstablished: business?.yearEstablished ? String(business.yearEstablished) : '',
    licenseNumber: business?.licenseNumber || '',
    npi: business?.npi || '',
    taxId: business?.taxId || '',
    disabilityTypes: (business?.businessDisabilities?.map((bd: any) => bd.disability?.slug).filter(Boolean) as string[]) || [],
  });

  const [hours, setHours] = useState<HoursValue>(() => {
    const stored = business?.hoursOfOperation;
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? { ...stored } : {};
  });

  // Mirrors the server zod schema so users get inline, per-field feedback instead
  // of one toast after a failed round-trip.
  const validate = (data: typeof formData): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (data.businessName.trim().length < 2) errs.businessName = 'Business name is required (at least 2 characters)';
    if (data.description.trim().length < 10) errs.description = 'Tell families what you do — at least 10 characters';
    if (!data.phone.trim()) errs.phone = 'Phone number is required';
    else if (!PHONE_RE.test(data.phone.trim())) errs.phone = 'Enter a valid US phone number';
    if (!data.email.trim()) errs.email = 'Email is required';
    else if (!EMAIL_RE.test(data.email.trim())) errs.email = 'Enter a valid email address';
    if (data.website.trim() && !/^https?:\/\//i.test(data.website.trim())) {
      errs.website = 'Website must start with http:// or https://';
    }
    if (!data.address.trim()) errs.address = 'Street address is required';
    if (!data.city.trim()) errs.city = 'City is required';
    if (!data.state.trim()) errs.state = 'Select your state';
    if (!/^\d{5}$/.test(data.zipCode.trim())) errs.zipCode = 'Enter a valid 5-digit ZIP code';
    if (data.yearEstablished.trim()) {
      const year = Number(data.yearEstablished);
      if (!Number.isInteger(year) || year < 1800 || year > new Date().getFullYear()) {
        errs.yearEstablished = `Enter a year between 1800 and ${new Date().getFullYear()}`;
      }
    }
    if (data.npi.trim() && data.npi.replace(/\D/g, '').length !== 10) errs.npi = 'NPI must be 10 digits';
    return errs;
  };

  // Derived, never stored. Once the provider has attempted a submit, the errors are
  // simply what validate() says about the current form — mirroring that into state
  // from an effect meant a second render on every keystroke to reach the same answer.
  // One validation pass per render feeds both of the things below. It is only
  // string checks over a dozen fields, so memoising it cost more in ceremony than
  // it saved — and the memo could not list `validate` as a dependency anyway.
  const currentErrors = validate(formData);

  // Errors are shown once the provider has actually tried to submit; before that
  // the form stays quiet.
  const fieldErrors = hasSubmitted ? currentErrors : NO_FIELD_ERRORS;

  // The summary banner is only meaningful while something is still highlighted, so
  // it hides itself as the last field is fixed rather than being cleared by hand.
  const visibleError =
    error === FIX_FIELDS_MESSAGE && Object.keys(fieldErrors).length === 0 ? '' : error;

  // Live count of what is still required, so the provider always knows how far off
  // they are rather than discovering it at submit time.
  const remaining = Object.keys(currentErrors).length;

  // The four fields we can actually check against an outside source. Shown as a
  // strength meter because "optional" reads as "skip me", and skipping all four
  // is what turns a same-day approval into a manual investigation.
  const signals = [
    { key: 'npi', label: 'NPI number', filled: !!formData.npi.trim() },
    { key: 'website', label: 'Website', filled: !!formData.website.trim() },
    { key: 'licenseNumber', label: 'License number', filled: !!formData.licenseNumber.trim() },
    { key: 'yearEstablished', label: 'Year established', filled: !!formData.yearEstablished.trim() },
  ];
  const signalCount = signals.filter((s) => s.filled).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setHasSubmitted(true);

    const errs = validate(formData);
    if (Object.keys(errs).length > 0) {
      setError(FIX_FIELDS_MESSAGE);
      document.getElementById(Object.keys(errs)[0])?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/business/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          userId,
          yearEstablished: formData.yearEstablished.trim() || undefined,
          hoursOfOperation: hours,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || 'Failed to save your details. Please try again.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
      // Deliberately no router.refresh() here: refreshing remounts this form and
      // discards the confirmation banner, so a provider who just waited out a save
      // is left staring at an unchanged page with no sign it worked. Server data
      // re-renders on the next navigation anyway.
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const toggleDisability = (slug: string) =>
    setFormData((prev) => ({
      ...prev,
      disabilityTypes: prev.disabilityTypes.includes(slug)
        ? prev.disabilityTypes.filter((s: string) => s !== slug)
        : [...prev.disabilityTypes, slug],
    }));

  const err = (field: string) =>
    fieldErrors[field] ? (
      <p className="field-error" role="alert">
        {fieldErrors[field]}
      </p>
    ) : null;

  const invalid = (field: string) => (fieldErrors[field] ? 'border-destructive' : '');

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {success && (
        <div className="theme-success flex flex-wrap items-center gap-3 p-4" role="status">
          <CheckCircle className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <span className="flex-1">Your business details are saved.</span>
          <Button asChild size="sm" variant="outline">
            <Link href="/business/listings">
              Next: add your listings <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      )}

      {visibleError && (
        <div className="theme-danger p-4" role="alert">
          {visibleError}
        </div>
      )}

      {/* Jump-to rail: this form is long, and a provider returning to fix one field
          should not have to scroll past five sections to find it. */}
      <nav aria-label="Form sections" className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {s.label}
          </a>
        ))}
      </nav>

      {/* About */}
      <Card id="about" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" aria-hidden="true" />
            About your business
          </CardTitle>
          <CardDescription>
            The name and overview families see first, on your profile and every listing you publish.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business name *</Label>
              <Input
                id="businessName"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                aria-invalid={!!fieldErrors.businessName}
                className={invalid('businessName')}
                required
              />
              {err('businessName')}
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessType">Business type</Label>
              <Input
                id="businessType"
                placeholder="e.g. Therapy clinic, Special education school"
                value={formData.businessType}
                onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">A short label for what kind of organisation you are.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Overview *</Label>
            <Textarea
              id="description"
              rows={6}
              placeholder="Who you are, how you work with families, and what makes your approach different…"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              aria-invalid={!!fieldErrors.description}
              aria-describedby="description-help"
              className={invalid('description')}
              required
            />
            {err('description')}
            <p id="description-help" className="text-xs text-muted-foreground">
              This describes your organisation as a whole. Each individual service, product, or event gets its own
              description when you create its listing. {formData.description.trim().length} characters.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card id="contact" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" aria-hidden="true" />
            How families reach you
          </CardTitle>
          <CardDescription>Shown on your public profile once you are approved.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  className={`pl-10 ${invalid('phone')}`}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  aria-invalid={!!fieldErrors.phone}
                  required
                />
              </div>
              {err('phone')}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Business email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="email"
                  type="email"
                  placeholder="contact@yourbusiness.com"
                  className={`pl-10 ${invalid('email')}`}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby="email-help"
                  required
                />
              </div>
              {err('email')}
              <p id="email-help" className="text-xs text-muted-foreground">
                An address at your own domain helps us confirm the business is yours.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="website"
                type="url"
                placeholder="https://www.yourbusiness.com"
                className={`pl-10 ${invalid('website')}`}
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                aria-invalid={!!fieldErrors.website}
              />
            </div>
            {err('website')}
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card id="location" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" aria-hidden="true" />
            Address
          </CardTitle>
          <CardDescription>
            Families search by location, so this decides who finds you. We check it against the public US address file —
            a PO box cannot be verified.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">Street address *</Label>
            <Input
              id="address"
              placeholder="123 Main Street"
              autoComplete="street-address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              aria-invalid={!!fieldErrors.address}
              className={invalid('address')}
              required
            />
            {err('address')}
          </div>
          <div className="space-y-2">
            <Label htmlFor="addressLine2">Suite, unit, or building</Label>
            <Input
              id="addressLine2"
              placeholder="Optional"
              value={formData.addressLine2}
              onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                autoComplete="address-level2"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                aria-invalid={!!fieldErrors.city}
                className={invalid('city')}
                required
              />
              {err('city')}
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <select
                id="state"
                className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ${invalid('state')}`}
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                aria-invalid={!!fieldErrors.state}
                required
              >
                <option value="">Select…</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {err('state')}
            </div>
            <div className="space-y-2">
              <Label htmlFor="zipCode">ZIP code *</Label>
              <Input
                id="zipCode"
                inputMode="numeric"
                maxLength={5}
                placeholder="12345"
                autoComplete="postal-code"
                value={formData.zipCode}
                onChange={(e) => setFormData({ ...formData, zipCode: e.target.value.replace(/\D/g, '') })}
                aria-invalid={!!fieldErrors.zipCode}
                className={invalid('zipCode')}
                required
              />
              {err('zipCode')}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verification credentials */}
      <Card id="credentials" className="scroll-mt-24 border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            What we verify you with
          </CardTitle>
          <CardDescription>
            All optional — but these are the only details we can confirm against an independent public source. The more
            you give us, the faster your approval and the higher the trust badge on your listings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Verification strength</span>
              <span className="text-sm text-muted-foreground">{signalCount} of 4 provided</span>
            </div>
            <div className="mt-2 flex gap-1" role="presentation">
              {signals.map((s) => (
                <span
                  key={s.key}
                  className={`h-1.5 flex-1 rounded-full ${s.filled ? 'bg-primary' : 'bg-border'}`}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {signalCount === 0
                ? 'With none of these, an admin has to verify you by hand — expect a slower review.'
                : signalCount === 4
                  ? 'Everything we can check automatically is here. Nice.'
                  : `Still missing: ${signals.filter((s) => !s.filled).map((s) => s.label).join(', ')}.`}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="npi">NPI (National Provider Identifier)</Label>
            <Input
              id="npi"
              inputMode="numeric"
              maxLength={12}
              placeholder="10 digits — e.g. 1234567893"
              value={formData.npi}
              onChange={(e) => setFormData({ ...formData, npi: e.target.value })}
              aria-invalid={!!fieldErrors.npi}
              className={invalid('npi')}
              aria-describedby="npi-help"
            />
            {err('npi')}
            <p id="npi-help" className="text-xs text-muted-foreground">
              The fastest route to approval, and the only way to reach the{' '}
              <span className="font-medium">Licensed &amp; Verified</span> badge — we match it against the public{' '}
              <a
                href="https://npiregistry.cms.hhs.gov/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                CMS NPPES registry
              </a>
              . Any provider who bills insurance has one.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="licenseNumber">License number</Label>
              <Input
                id="licenseNumber"
                placeholder="State license or registration"
                value={formData.licenseNumber}
                onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yearEstablished">Year established</Label>
              <Input
                id="yearEstablished"
                type="number"
                inputMode="numeric"
                placeholder="2015"
                value={formData.yearEstablished}
                onChange={(e) => setFormData({ ...formData, yearEstablished: e.target.value })}
                aria-invalid={!!fieldErrors.yearEstablished}
                className={invalid('yearEstablished')}
              />
              {err('yearEstablished')}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="taxId">Tax ID / EIN</Label>
            <Input
              id="taxId"
              placeholder="Optional"
              value={formData.taxId}
              onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
              aria-describedby="taxId-help"
            />
            <p id="taxId-help" className="text-xs text-muted-foreground">
              Never shown publicly. Used only by our review team to confirm the business is registered.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Who you serve */}
      <Card id="who" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HeartHandshake className="h-5 w-5" aria-hidden="true" />
            Who you serve
          </CardTitle>
          <CardDescription>
            The disabilities and needs your organisation supports overall. You will pick these again per listing, where
            they drive what families find when they filter.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!optionsLoaded ? (
            <p className="py-2 text-sm text-muted-foreground">Loading…</p>
          ) : availableDisabilities.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No options available yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableDisabilities.map((d) => {
                const selected = formData.disabilityTypes.includes(d.slug);
                return (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleDisability(d.slug)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hours */}
      <Card id="hours" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" aria-hidden="true" />
            Hours of operation
          </CardTitle>
          <CardDescription>When you are open to families.</CardDescription>
        </CardHeader>
        <CardContent>
          <HoursOfOperationEditor value={hours} onChange={setHours} />
        </CardContent>
      </Card>

      {/* Where listings live — stated explicitly, because everything above is
          about the organisation and providers expect pricing to be here too. */}
      <div className="theme-note flex flex-wrap items-center gap-3 p-4">
        <Info className="h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="flex-1 text-sm">
          <strong>Looking for pricing, ages, or categories?</strong> Those belong to individual listings — add one for
          each service, therapy, product, program, or event you offer.
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/business/listings">Go to listings</Link>
        </Button>
      </div>

      {/* Sticky save bar: the form is long enough that a save button only at the
          bottom means scrolling back down after every correction. */}
      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:mx-0 sm:rounded-lg sm:border">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={loading} className="min-h-[48px] flex-1 sm:flex-none">
            {/* Saving runs the registry checks inline and can take 10-20 seconds,
                so the label says what is happening rather than a bare "Saving…"
                that reads as a hang. */}
            {loading ? 'Saving and checking your details…' : 'Save business details'}
          </Button>
          <Button type="button" size="lg" variant="outline" onClick={() => router.push('/business/dashboard')}>
            Back to dashboard
          </Button>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {hasSubmitted && remaining > 0
              ? `${remaining} field${remaining === 1 ? '' : 's'} still need attention.`
              : 'You can come back and edit any of this later.'}
          </p>
        </div>
      </div>
    </form>
  );
}
