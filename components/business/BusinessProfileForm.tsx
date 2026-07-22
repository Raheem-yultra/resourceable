'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Building2, MapPin, Phone, Mail, Globe, Clock, DollarSign, Users, CheckCircle,
  Tag, Stethoscope, HeartHandshake, ShoppingBag, GraduationCap, CalendarDays,
} from 'lucide-react';
import { LISTING_TYPES, type BookableListingType } from '@/lib/listing-taxonomy';

const LISTING_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Stethoscope, HeartHandshake, ShoppingBag, GraduationCap, CalendarDays,
};
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

// Age groups mirror the Prisma AgeGroup enum exactly (values MUST match the enum, not just labels)
const AGE_GROUPS = [
  { value: 'INFANT', label: 'Infant (0-2 years)' },
  { value: 'TODDLER', label: 'Toddler (2-5 years)' },
  { value: 'CHILD', label: 'Child (5-12 years)' },
  { value: 'TEEN', label: 'Teen (12-18 years)' },
  { value: 'ADULT', label: 'Adult (18+ years)' },
  { value: 'ALL_AGES', label: 'All Ages' },
];

// Price range values mirror the Prisma PriceRange enum exactly
const PRICE_RANGES = [
  { value: 'FREE', label: 'Free' },
  { value: 'LOW', label: '$ - Budget Friendly (Under $50/session)' },
  { value: 'MEDIUM', label: '$$ - Moderate ($50-$150/session)' },
  { value: 'HIGH', label: '$$$ - Higher ($150-$300/session)' },
  { value: 'PREMIUM', label: '$$$$ - Premium ($300+/session)' },
  { value: 'CONTACT', label: 'Contact for Pricing' },
];

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

export function BusinessProfileForm({ business, userId }: BusinessProfileFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Disability & service-type options come from the DB so their slugs match what the API expects
  const [availableDisabilities, setAvailableDisabilities] = useState<FilterOption[]>([]);
  const [availableServiceTypes, setAvailableServiceTypes] = useState<FilterOption[]>([]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [dRes, sRes] = await Promise.all([
          fetch('/api/disabilities'),
          fetch('/api/service-types'),
        ]);
        if (dRes.ok) setAvailableDisabilities((await dRes.json()).disabilities || []);
        if (sRes.ok) setAvailableServiceTypes((await sRes.json()).serviceTypes || []);
      } catch (err) {
        console.error('Failed to load disability/service-type options:', err);
      }
    };
    loadOptions();
  }, []);

  const [formData, setFormData] = useState({
    // Basic Info
    businessName: business?.businessName || '',
    businessType: business?.businessType || '',
    description: business?.description || '',
    phone: business?.phone || '',
    email: business?.email || '',
    website: business?.website || '',
    
    // Address
    address: business?.address || '',
    addressLine2: business?.addressLine2 || '',
    city: business?.city || '',
    state: business?.state || '',
    zipCode: business?.zipCode || '',
    
    // Business Details
    yearEstablished: business?.yearEstablished || '',
    licenseNumber: business?.licenseNumber || '',
    npi: business?.npi || '',
    
    // Services & Disabilities — bind to DB slugs so selections round-trip correctly
    serviceTypes: business?.services?.[0]?.serviceTypes?.map((st: any) => st.serviceType?.slug).filter(Boolean) || [],
    disabilityTypes: business?.businessDisabilities?.map((bd: any) => bd.disability.slug) || [],
    ageGroups: business?.services?.[0]?.ageGroups || [],
    
    // Pricing
    priceRange: business?.services?.[0]?.priceRange || 'CONTACT',
    priceMin: business?.services?.[0]?.priceMin || '',
    priceMax: business?.services?.[0]?.priceMax || '',
    pricingDetails: business?.services?.[0]?.pricingDetails || '',
    
    // Capacity & Availability
    capacity: business?.services?.[0]?.capacity || '',
    waitlistAvailable: business?.services?.[0]?.waitlistAvailable || false,
    acceptingNewClients: business?.services?.[0]?.acceptingNewClients !== false,
    
    // Insurance & Payment
    insuranceAccepted: business?.services?.[0]?.insuranceAccepted || false,
    acceptedInsurances: business?.services?.[0]?.acceptedInsurances || '',

    // Hours
    hoursOfOperation: business?.hoursOfOperation || '',

    // Category-expansion: listing kind + type-specific fields
    listingType: (business?.services?.[0]?.listingType || 'SERVICE') as BookableListingType,
    deliveryMode: business?.services?.[0]?.deliveryMode || '',
    condition: business?.services?.[0]?.condition || '',
    isForRent: business?.services?.[0]?.isForRent || false,
    brand: business?.services?.[0]?.brand || '',
    enrollmentStatus: business?.services?.[0]?.enrollmentStatus || '',
    programType: business?.services?.[0]?.programType || '',
    gradeLevels: business?.services?.[0]?.gradeLevels || [],
    startDate: business?.services?.[0]?.startDate ? String(business.services[0].startDate).slice(0, 10) : '',
    endDate: business?.services?.[0]?.endDate ? String(business.services[0].endDate).slice(0, 10) : '',
    isVirtual: business?.services?.[0]?.isVirtual || false,
  });

  // Only show subcategories that belong to the chosen listing type (plan §7.7);
  // legacy untyped service types stay available under every type.
  const visibleServiceTypes = availableServiceTypes.filter(
    (t: any) => !t.listingType || t.listingType === formData.listingType
  );
  const activeTypeMeta = LISTING_TYPES.find((t) => t.type === formData.listingType);

  // Client-side validation mirrors the server zod schema so users get inline feedback
  // per field instead of a single toast after a failed round-trip.
  const validate = (data: typeof formData): Record<string, string> => {
    const errs: Record<string, string> = {};
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.businessName.trim() || data.businessName.trim().length < 2) errs.businessName = 'Business name is required (min 2 characters)';
    if (!data.description.trim() || data.description.trim().length < 10) errs.description = 'Description is required (min 10 characters)';
    if (!data.phone.trim()) errs.phone = 'Phone number is required';
    if (!data.email.trim()) errs.email = 'Email is required';
    else if (!emailRe.test(data.email)) errs.email = 'Enter a valid email address';
    if (data.website && !/^https?:\/\//i.test(data.website)) errs.website = 'Website must start with http:// or https://';
    if (!data.address.trim()) errs.address = 'Street address is required';
    if (!data.city.trim()) errs.city = 'City is required';
    if (!data.state.trim()) errs.state = 'State is required';
    if (!data.zipCode.trim()) errs.zipCode = 'ZIP code is required';
    if (data.serviceTypes.length === 0) errs.serviceTypes = 'Select at least one service type';
    if (data.disabilityTypes.length === 0) errs.disabilityTypes = 'Select at least one disability served';
    if (data.ageGroups.length === 0) errs.ageGroups = 'Select at least one age group';
    const min = parseFloat(data.priceMin);
    const max = parseFloat(data.priceMax);
    if (data.priceMin && data.priceMax && !isNaN(min) && !isNaN(max) && min > max) errs.priceMin = 'Minimum price cannot exceed maximum';
    return errs;
  };

  // Once the user has attempted submit, keep errors live as they fix each field
  useEffect(() => {
    if (hasSubmitted) setFieldErrors(validate(formData));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, hasSubmitted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setHasSubmitted(true);

    const errs = validate(formData);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError('Please fix the highlighted fields before submitting.');
      document.getElementById(Object.keys(errs)[0])?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/business/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update profile');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/business/dashboard');
        router.refresh();
      }, 2000);
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const toggleArrayItem = (array: string[], item: string) => {
    if (array.includes(item)) {
      return array.filter((i) => i !== item);
    }
    return [...array, item];
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      {/* Success Message */}
      {success && (
        <div className="theme-success p-4 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
          <span>Profile updated successfully! Redirecting to dashboard...</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="theme-danger p-4" role="alert">
          {error}
        </div>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Basic Information
          </CardTitle>
          <CardDescription>Tell us about your business</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name *</Label>
              <Input
                id="businessName"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                aria-invalid={!!fieldErrors.businessName}
                className={fieldErrors.businessName ? 'border-destructive' : ''}
                required
              />
              {fieldErrors.businessName && <p className="field-error" role="alert">{fieldErrors.businessName}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessType">Business Type</Label>
              <Input
                id="businessType"
                placeholder="e.g., Therapy Center, Educational Facility"
                value={formData.businessType}
                onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              rows={6}
              placeholder="Describe your services, approach, and what makes your business unique..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              aria-invalid={!!fieldErrors.description}
              className={fieldErrors.description ? 'border-destructive' : ''}
              required
            />
            {fieldErrors.description ? (
              <p className="field-error" role="alert">{fieldErrors.description}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                This will be the main description customers see. Be detailed and welcoming.
              </p>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="yearEstablished">Year Established</Label>
              <Input
                id="yearEstablished"
                type="number"
                placeholder="2020"
                value={formData.yearEstablished}
                onChange={(e) => setFormData({ ...formData, yearEstablished: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="licenseNumber">License Number</Label>
              <Input
                id="licenseNumber"
                placeholder="Optional"
                value={formData.licenseNumber}
                onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
              />
            </div>
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
              aria-describedby="npi-help"
            />
            <p id="npi-help" className="text-xs text-muted-foreground">
              Optional, but it&apos;s the fastest route to approval and the only way to reach the{' '}
              <span className="font-medium">Licensed</span> badge — we verify it against the public{' '}
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
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Contact Information
          </CardTitle>
          <CardDescription>How can customers reach you?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  className={`pl-10 ${fieldErrors.phone ? 'border-destructive' : ''}`}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  aria-invalid={!!fieldErrors.phone}
                  required
                />
              </div>
              {fieldErrors.phone && <p className="field-error" role="alert">{fieldErrors.phone}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="contact@business.com"
                  className={`pl-10 ${fieldErrors.email ? 'border-destructive' : ''}`}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  aria-invalid={!!fieldErrors.email}
                  required
                />
              </div>
              {fieldErrors.email && <p className="field-error" role="alert">{fieldErrors.email}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="website"
                type="url"
                placeholder="https://www.yourbusiness.com"
                className={`pl-10 ${fieldErrors.website ? 'border-destructive' : ''}`}
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                aria-invalid={!!fieldErrors.website}
              />
            </div>
            {fieldErrors.website && <p className="field-error" role="alert">{fieldErrors.website}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location
          </CardTitle>
          <CardDescription>Where are you located?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">Street Address *</Label>
            <Input
              id="address"
              placeholder="123 Main Street"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              aria-invalid={!!fieldErrors.address}
              className={fieldErrors.address ? 'border-destructive' : ''}
              required
            />
            {fieldErrors.address && <p className="field-error" role="alert">{fieldErrors.address}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="addressLine2">Address Line 2</Label>
            <Input
              id="addressLine2"
              placeholder="Suite, Unit, Building (optional)"
              value={formData.addressLine2}
              onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
            />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                aria-invalid={!!fieldErrors.city}
                className={fieldErrors.city ? 'border-destructive' : ''}
                required
              />
              {fieldErrors.city && <p className="field-error" role="alert">{fieldErrors.city}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Input
                id="state"
                placeholder="CA"
                maxLength={2}
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                aria-invalid={!!fieldErrors.state}
                className={fieldErrors.state ? 'border-destructive' : ''}
                required
              />
              {fieldErrors.state && <p className="field-error" role="alert">{fieldErrors.state}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="zipCode">ZIP Code *</Label>
              <Input
                id="zipCode"
                placeholder="12345"
                maxLength={5}
                value={formData.zipCode}
                onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                aria-invalid={!!fieldErrors.zipCode}
                className={fieldErrors.zipCode ? 'border-destructive' : ''}
                required
              />
              {fieldErrors.zipCode && <p className="field-error" role="alert">{fieldErrors.zipCode}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listing type — "What do you offer?" (plan §7.7) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            What do you offer?
          </CardTitle>
          <CardDescription>
            Pick the category that best fits your listing. This determines how you appear in browse and which details we ask for.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Listing type">
            {LISTING_TYPES.map((t) => {
              const Icon = LISTING_TYPE_ICONS[t.icon] || Tag;
              const selected = formData.listingType === t.type;
              return (
                <button
                  type="button"
                  key={t.type}
                  role="radio"
                  aria-checked={selected}
                  onClick={() =>
                    // Switching type clears subcategory picks so we never persist
                    // cross-type mappings (e.g. a Shop item tagged "Speech Therapy").
                    setFormData({ ...formData, listingType: t.type, serviceTypes: [] })
                  }
                  className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors min-h-[88px] ${
                    selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent'
                  }`}
                >
                  <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                  <span className="text-sm font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Services Offered */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {activeTypeMeta ? `${activeTypeMeta.label} — categories` : 'Services & Specializations'}
          </CardTitle>
          <CardDescription>Which subcategories apply?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Categories * (Select all that apply)</Label>
            {fieldErrors.serviceTypes && <p className="field-error" role="alert">{fieldErrors.serviceTypes}</p>}
            {availableServiceTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Loading categories…</p>
            ) : visibleServiceTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No categories defined for this type yet.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {visibleServiceTypes.map((type) => (
                  <label
                    key={type.id}
                    className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={formData.serviceTypes.includes(type.slug)}
                      onChange={() =>
                        setFormData({
                          ...formData,
                          serviceTypes: toggleArrayItem(formData.serviceTypes, type.slug),
                        })
                      }
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium">{type.name}</div>
                      {type.category && (
                        <div className="text-xs text-muted-foreground">{type.category}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label>Disabilities Served * (Select all that apply)</Label>
            {fieldErrors.disabilityTypes && <p className="field-error" role="alert">{fieldErrors.disabilityTypes}</p>}
            {availableDisabilities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Loading disabilities…</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {availableDisabilities.map((type) => (
                  <label
                    key={type.id}
                    className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={formData.disabilityTypes.includes(type.slug)}
                      onChange={() =>
                        setFormData({
                          ...formData,
                          disabilityTypes: toggleArrayItem(formData.disabilityTypes, type.slug),
                        })
                      }
                    />
                    <span className="font-medium text-sm">{type.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label>Age Groups Served * (Select all that apply)</Label>
            {fieldErrors.ageGroups && <p className="field-error" role="alert">{fieldErrors.ageGroups}</p>}
            <div className="grid md:grid-cols-3 gap-3">
              {AGE_GROUPS.map((age) => (
                <label
                  key={age.value}
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={formData.ageGroups.includes(age.value)}
                    onChange={() =>
                      setFormData({
                        ...formData,
                        ageGroups: toggleArrayItem(formData.ageGroups, age.value),
                      })
                    }
                  />
                  <span className="font-medium text-sm">{age.label}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Type-specific details (plan §3 extension fields) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            {activeTypeMeta?.singular || 'Listing'} details
          </CardTitle>
          <CardDescription>Details specific to {activeTypeMeta?.label.toLowerCase() || 'this listing'}.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Delivery/format — Services, Therapies, Events */}
          {(formData.listingType === 'SERVICE' ||
            formData.listingType === 'THERAPY' ||
            formData.listingType === 'EVENT') && (
            <div className="space-y-2">
              <Label htmlFor="deliveryMode">Delivery format</Label>
              <select
                id="deliveryMode"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.deliveryMode}
                onChange={(e) => setFormData({ ...formData, deliveryMode: e.target.value })}
              >
                <option value="">Not specified</option>
                {DELIVERY_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Shop */}
          {formData.listingType === 'SHOP' && (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="condition">Condition</Label>
                  <select
                    id="condition"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                  >
                    <option value="">Not specified</option>
                    {CONDITIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand">Brand</Label>
                  <Input
                    id="brand"
                    placeholder="e.g., Tobii Dynavox"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isForRent}
                  onChange={(e) => setFormData({ ...formData, isForRent: e.target.checked })}
                />
                <div>
                  <div className="font-medium">Available to rent</div>
                  <div className="text-xs text-muted-foreground">Offered as a rental rather than an outright sale</div>
                </div>
              </label>
            </>
          )}

          {/* School */}
          {formData.listingType === 'SCHOOL' && (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="enrollmentStatus">Enrollment status</Label>
                  <Input
                    id="enrollmentStatus"
                    placeholder="Open, Waitlist, Closed"
                    value={formData.enrollmentStatus}
                    onChange={(e) => setFormData({ ...formData, enrollmentStatus: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="programType">Program type</Label>
                  <Input
                    id="programType"
                    placeholder="e.g., Day school, After-school"
                    value={formData.programType}
                    onChange={(e) => setFormData({ ...formData, programType: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gradeLevels">Grade levels (comma-separated)</Label>
                <Input
                  id="gradeLevels"
                  placeholder="K, 1, 2, 3"
                  value={Array.isArray(formData.gradeLevels) ? formData.gradeLevels.join(', ') : ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      gradeLevels: e.target.value.split(',').map((g) => g.trim()).filter(Boolean),
                    })
                  }
                />
              </div>
            </>
          )}

          {/* Event */}
          {formData.listingType === 'EVENT' && (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isVirtual}
                  onChange={(e) => setFormData({ ...formData, isVirtual: e.target.checked })}
                />
                <div>
                  <div className="font-medium">Virtual event</div>
                  <div className="text-xs text-muted-foreground">Attendees join online</div>
                </div>
              </label>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pricing & Availability */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Pricing & Availability
          </CardTitle>
          <CardDescription>Help customers understand your pricing and capacity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>Price Range</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.priceRange}
              onChange={(e) => setFormData({ ...formData, priceRange: e.target.value })}
            >
              {PRICE_RANGES.map((range) => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priceMin">Minimum Price (Optional)</Label>
              <Input
                id="priceMin"
                type="number"
                placeholder="50.00"
                step="0.01"
                value={formData.priceMin}
                onChange={(e) => setFormData({ ...formData, priceMin: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priceMax">Maximum Price (Optional)</Label>
              <Input
                id="priceMax"
                type="number"
                placeholder="150.00"
                step="0.01"
                value={formData.priceMax}
                onChange={(e) => setFormData({ ...formData, priceMax: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pricingDetails">Pricing Details</Label>
            <Textarea
              id="pricingDetails"
              rows={3}
              placeholder="Explain your pricing structure, packages, or any additional fees..."
              value={formData.pricingDetails}
              onChange={(e) => setFormData({ ...formData, pricingDetails: e.target.value })}
            />
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={formData.insuranceAccepted}
                onChange={(e) => setFormData({ ...formData, insuranceAccepted: e.target.checked })}
              />
              <div>
                <div className="font-medium">Insurance Accepted</div>
                <div className="text-xs text-muted-foreground">We accept insurance payments</div>
              </div>
            </label>

            {formData.insuranceAccepted && (
              <div className="space-y-2">
                <Label htmlFor="acceptedInsurances">Accepted Insurance Providers</Label>
                <Textarea
                  id="acceptedInsurances"
                  rows={3}
                  placeholder="List insurance providers you accept (e.g., Blue Cross, Aetna, Medicare, Medicaid...)"
                  value={formData.acceptedInsurances}
                  onChange={(e) => setFormData({ ...formData, acceptedInsurances: e.target.value })}
                />
              </div>
            )}

            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={formData.acceptingNewClients}
                onChange={(e) => setFormData({ ...formData, acceptingNewClients: e.target.checked })}
              />
              <div>
                <div className="font-medium">Accepting New Clients</div>
                <div className="text-xs text-muted-foreground">Currently accepting new customers</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={formData.waitlistAvailable}
                onChange={(e) => setFormData({ ...formData, waitlistAvailable: e.target.checked })}
              />
              <div>
                <div className="font-medium">Waitlist Available</div>
                <div className="text-xs text-muted-foreground">Customers can join a waiting list</div>
              </div>
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="capacity">Current Capacity</Label>
            <Input
              id="capacity"
              type="number"
              placeholder="e.g., 20 (number of clients you can serve)"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Hours of Operation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Hours of Operation
          </CardTitle>
          <CardDescription>When are you available?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="hoursOfOperation">Business Hours</Label>
            <Textarea
              id="hoursOfOperation"
              rows={4}
              placeholder="Monday-Friday: 9:00 AM - 5:00 PM&#10;Saturday: 10:00 AM - 2:00 PM&#10;Sunday: Closed"
              value={formData.hoursOfOperation}
              onChange={(e) => setFormData({ ...formData, hoursOfOperation: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex gap-4">
        <Button type="submit" size="lg" className="flex-1" disabled={loading}>
          {loading ? 'Saving...' : business ? 'Update Profile' : 'Create Profile'}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={() => router.push('/business/dashboard')}
        >
          Cancel
        </Button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> This is your single comprehensive business listing. All the information you provide here will be visible to customers searching for services. Your listing will be reviewed by our admin team before being published.
        </p>
      </div>
    </form>
  );
}
