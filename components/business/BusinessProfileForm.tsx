'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, MapPin, Phone, Mail, Globe, Clock, DollarSign, Users, CheckCircle } from 'lucide-react';

const DISABILITY_TYPES = [
  { value: 'AUTISM', label: 'Autism Spectrum Disorder' },
  { value: 'DOWN_SYNDROME', label: 'Down Syndrome' },
  { value: 'ADHD', label: 'ADHD' },
  { value: 'CEREBRAL_PALSY', label: 'Cerebral Palsy' },
  { value: 'INTELLECTUAL_DISABILITY', label: 'Intellectual Disability' },
  { value: 'LEARNING_DISABILITY', label: 'Learning Disability' },
  { value: 'DEVELOPMENTAL_DELAY', label: 'Developmental Delay' },
  { value: 'PHYSICAL_DISABILITY', label: 'Physical Disability' },
  { value: 'SENSORY_DISABILITY', label: 'Sensory Disability (Visual/Hearing)' },
  { value: 'SPEECH_LANGUAGE', label: 'Speech & Language Disorders' },
  { value: 'OTHER', label: 'Other Disabilities' },
];

const SERVICE_TYPES = [
  { value: 'THERAPY', label: 'Therapy Services', description: 'Speech, Physical, Occupational' },
  { value: 'EDUCATION', label: 'Educational Programs', description: 'Special education, tutoring' },
  { value: 'RESIDENTIAL', label: 'Residential Care', description: 'Group homes, assisted living' },
  { value: 'DAY_PROGRAM', label: 'Day Programs', description: 'Day habilitation, adult day care' },
  { value: 'RESPITE_CARE', label: 'Respite Care', description: 'Short-term relief care' },
  { value: 'MEDICAL', label: 'Medical Services', description: 'Healthcare, nursing' },
  { value: 'RECREATIONAL', label: 'Recreation & Sports', description: 'Adaptive sports, camps' },
  { value: 'VOCATIONAL', label: 'Vocational Training', description: 'Job training, employment support' },
  { value: 'COUNSELING', label: 'Counseling & Mental Health', description: 'Therapy, support' },
  { value: 'SUPPORT_GROUP', label: 'Support Groups', description: 'Peer support, family groups' },
  { value: 'TRANSPORTATION', label: 'Transportation Services', description: 'Medical transport, school bus' },
  { value: 'OTHER', label: 'Other Services', description: 'Additional specialized services' },
];

const AGE_GROUPS = [
  { value: 'INFANT', label: 'Infant (0-2 years)' },
  { value: 'TODDLER', label: 'Toddler (2-5 years)' },
  { value: 'CHILD', label: 'Child (5-12 years)' },
  { value: 'TEEN', label: 'Teen (13-17 years)' },
  { value: 'ADULT', label: 'Adult (18+ years)' },
  { value: 'SENIOR', label: 'Senior (65+ years)' },
];

interface BusinessProfileFormProps {
  business: any;
  userId: string;
}

export function BusinessProfileForm({ business, userId }: BusinessProfileFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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
    
    // Services & Disabilities
    serviceTypes: business?.services?.[0]?.serviceTypes?.map((st: any) => st.slug) || [],
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
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Success Message */}
      {success && (
        <div className="theme-success p-4 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
          <span>Profile updated successfully! Redirecting to dashboard...</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="theme-danger p-4">
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
                required
              />
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
              required
            />
            <p className="text-xs text-muted-foreground">
              This will be the main description customers see. Be detailed and welcoming.
            </p>
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
                  className="pl-10"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="contact@business.com"
                  className="pl-10"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
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
                className="pl-10"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              />
            </div>
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
              required
            />
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
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Input
                id="state"
                placeholder="CA"
                maxLength={2}
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zipCode">ZIP Code *</Label>
              <Input
                id="zipCode"
                placeholder="12345"
                maxLength={5}
                value={formData.zipCode}
                onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services Offered */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Services & Specializations
          </CardTitle>
          <CardDescription>What services do you provide?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Service Types * (Select all that apply)</Label>
            <div className="grid md:grid-cols-2 gap-3">
              {SERVICE_TYPES.map((type) => (
                <label
                  key={type.value}
                  className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={formData.serviceTypes.includes(type.value)}
                    onChange={() =>
                      setFormData({
                        ...formData,
                        serviceTypes: toggleArrayItem(formData.serviceTypes, type.value),
                      })
                    }
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium">{type.label}</div>
                    <div className="text-xs text-muted-foreground">{type.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Disabilities Served * (Select all that apply)</Label>
            <div className="grid md:grid-cols-2 gap-3">
              {DISABILITY_TYPES.map((type) => (
                <label
                  key={type.value}
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={formData.disabilityTypes.includes(type.value)}
                    onChange={() =>
                      setFormData({
                        ...formData,
                        disabilityTypes: toggleArrayItem(formData.disabilityTypes, type.value),
                      })
                    }
                  />
                  <span className="font-medium text-sm">{type.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Age Groups Served * (Select all that apply)</Label>
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
              <option value="FREE">Free</option>
              <option value="BUDGET">$ - Budget Friendly (Under $50/session)</option>
              <option value="MODERATE">$$ - Moderate ($50-$150/session)</option>
              <option value="PREMIUM">$$$ - Premium ($150-$300/session)</option>
              <option value="LUXURY">$$$$ - Luxury ($300+/session)</option>
              <option value="CONTACT">Contact for Pricing</option>
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
