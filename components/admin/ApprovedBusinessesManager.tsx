'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Building2, Mail, Phone, MapPin, Calendar, Users, Search, Ban, Trash2,
  AlertTriangle, CheckCircle, Eye, ExternalLink, DollarSign, RotateCcw, UserCheck,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Service {
  id: string;
  name: string;
  description?: string;
  priceRange?: string;
  priceMin?: number | null;
  priceMax?: number | null;
  pricingDetails?: string | null;
  duration?: string | null;
  frequency?: string | null;
  ageGroups?: string[];
  insuranceAccepted?: boolean;
  serviceTypes?: Array<{ serviceType: { name: string } }>;
  createdAt: string;
}

interface Business {
  id: string;
  businessName: string;
  businessType?: string;
  description?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  verificationStatus: string;
  verificationLevel?: string;
  isActive?: boolean;
  isSuspended?: boolean;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  createdAt: string;
  // Billing (Pass 4)
  subscriptionStatus?: string | null;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  stripeSubscriptionId?: string | null;
  user: { id: string; email: string; name?: string };
  services?: Service[];
  businessDisabilities?: Array<{ disability: { name: string } }>;
  _count?: { services: number };
}

type ActionType = 'suspend' | 'remove' | 'view' | 'unsuspend' | 'extend_trial';

// Presentation for each billing status. `null`/'none' = approved but no subscription yet.
const SUB_STATUS_META: Record<string, { label: string; cls: string }> = {
  trialing: { label: 'Trialing', cls: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800' },
  active: { label: 'Active', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  past_due: { label: 'Past due', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  suspended_billing: { label: 'Suspended (billing)', cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900' },
  canceled: { label: 'Canceled', cls: 'bg-muted text-muted-foreground border-border' },
  none: { label: 'No billing', cls: 'bg-muted text-muted-foreground border-border' },
};

// Statuses that still have a live Stripe subscription we can extend the trial on.
const EXTENDABLE = new Set(['trialing', 'active', 'past_due', 'suspended_billing']);

// Provider trust tier (plan §4). Changing it re-syncs every listing's denormalized copy.
const VERIFICATION_LEVELS = [
  { value: 'UNVERIFIED', label: 'Unverified', cls: 'bg-muted text-muted-foreground border-border' },
  { value: 'BASIC_VERIFIED', label: 'Verified', cls: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800' },
  { value: 'LICENSED', label: 'Licensed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
];
const VERIFICATION_META: Record<string, { label: string; cls: string }> = Object.fromEntries(
  VERIFICATION_LEVELS.map((v) => [v.value, { label: v.label, cls: v.cls }])
);

const SUB_FILTER_OPTIONS = [
  { value: '', label: 'All billing statuses' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'active', label: 'Active' },
  { value: 'past_due', label: 'Past due' },
  { value: 'suspended_billing', label: 'Suspended (billing)' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'none', label: 'No billing yet' },
];

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString() : null;
}

const PRICE_RANGE_LABELS: Record<string, string> = {
  FREE: 'Free', LOW: '$ (Under $50)', MEDIUM: '$$ ($50–$150)', HIGH: '$$$ ($150–$300)', PREMIUM: '$$$$ ($300+)', CONTACT: 'Contact for pricing',
};

export function ApprovedBusinessesManager() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [reason, setReason] = useState('');
  const [trialDate, setTrialDate] = useState('');
  const [processing, setProcessing] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const handleSetVerificationLevel = async (businessId: string, level: string) => {
    setVerifyingId(businessId);
    try {
      const res = await fetch(`/api/admin/businesses/${businessId}/verification-level`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationLevel: level }),
      });
      if (res.ok) {
        // Reflect immediately without a full refetch.
        setBusinesses((prev) => prev.map((b) => (b.id === businessId ? { ...b, verificationLevel: level } : b)));
      }
    } catch (error) {
      console.error('Failed to set verification level:', error);
    } finally {
      setVerifyingId(null);
    }
  };

  const fetchApprovedBusinesses = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/businesses/approved');
      if (response.ok) {
        const data = await response.json();
        setBusinesses(data.businesses);
      }
    } catch (error) {
      console.error('Failed to fetch approved businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovedBusinesses();
  }, []);

  const filteredBusinesses = businesses.filter((b) => {
    // Billing status filter ('none' matches approved providers with no subscription row)
    if (statusFilter) {
      const status = b.subscriptionStatus ?? 'none';
      if (status !== statusFilter) return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.businessName.toLowerCase().includes(q) ||
      b.user.email.toLowerCase().includes(q) ||
      b.city?.toLowerCase().includes(q) ||
      b.state?.toLowerCase().includes(q)
    );
  });

  const openActionDialog = (business: Business, action: ActionType) => {
    setSelectedBusiness(business);
    setActionType(action);
    setReason('');
    // Default the extend-trial picker to +14 days from today.
    if (action === 'extend_trial') {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      setTrialDate(d.toISOString().slice(0, 10));
    }
  };

  const closeActionDialog = () => {
    setSelectedBusiness(null);
    setActionType(null);
    setReason('');
    setTrialDate('');
  };

  // Manual override: extend the provider's trial. Drives Stripe via the API,
  // which re-syncs our DB, so the returned status is authoritative.
  const handleExtendTrial = async () => {
    if (!selectedBusiness || !trialDate) return;
    // Send end-of-day UTC so the chosen date is fully included.
    const trialEndsAt = new Date(`${trialDate}T23:59:59.000Z`).toISOString();

    setProcessing(true);
    try {
      const response = await fetch(`/api/admin/businesses/${selectedBusiness.id}/billing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extend_trial', trialEndsAt, reason: reason.trim() || undefined }),
      });
      const data = await response.json();
      if (response.ok) {
        setBusinesses((prev) =>
          prev.map((b) =>
            b.id === selectedBusiness.id
              ? { ...b, subscriptionStatus: data.subscriptionStatus ?? b.subscriptionStatus, trialEndsAt: trialEndsAt }
              : b
          )
        );
        closeActionDialog();
      } else {
        alert(`Failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to extend trial:', error);
      alert('Failed to extend trial');
    } finally {
      setProcessing(false);
    }
  };

  const handleAction = async () => {
    if (!selectedBusiness || !actionType) return;
    // Unsuspend needs no reason; suspend/remove do
    if ((actionType === 'suspend' || actionType === 'remove') && !reason.trim()) {
      alert('Please provide a reason for this action');
      return;
    }

    setProcessing(true);
    try {
      let endpoint = '';
      let method = 'PATCH';
      if (actionType === 'suspend') endpoint = `/api/admin/businesses/${selectedBusiness.id}/suspend`;
      else if (actionType === 'unsuspend') endpoint = `/api/admin/businesses/${selectedBusiness.id}/unsuspend`;
      else if (actionType === 'remove') { endpoint = `/api/admin/businesses/${selectedBusiness.id}/remove`; method = 'DELETE'; }

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actionType === 'unsuspend' ? {} : { reason }),
      });

      if (response.ok) {
        if (actionType === 'remove') {
          setBusinesses((prev) => prev.filter((b) => b.id !== selectedBusiness.id));
        } else {
          // suspend / unsuspend flips the suspended state in place
          const nowSuspended = actionType === 'suspend';
          setBusinesses((prev) =>
            prev.map((b) =>
              b.id === selectedBusiness.id
                ? { ...b, isSuspended: nowSuspended, isActive: !nowSuspended, suspensionReason: nowSuspended ? reason : null }
                : b
            )
          );
        }
        closeActionDialog();
      } else {
        const data = await response.json();
        alert(`Failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`Failed to ${actionType} business:`, error);
      alert(`Failed to ${actionType} business`);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-lg border bg-muted/40" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Approved Businesses</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredBusinesses.length} business{filteredBusinesses.length !== 1 ? 'es' : ''}
            {' · '}
            {filteredBusinesses.filter((b) => b.isSuspended).length} suspended
          </p>
        </div>
        <div className="flex w-full sm:w-auto gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by billing status"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {SUB_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name, email, location..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
        </div>
      </div>

      {filteredBusinesses.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              {searchQuery ? 'No businesses match your search.' : 'No approved businesses found.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredBusinesses.map((business) => (
            <Card key={business.id} className={`overflow-hidden transition-shadow hover:shadow-lg ${business.isSuspended ? 'border-amber-300 dark:border-amber-800' : ''}`}>
              <CardHeader className="bg-primary/5 border-b">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 bg-background rounded-lg shadow-sm border border-border">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-1">{business.businessName}</CardTitle>
                      <p className="text-sm text-muted-foreground">{business.businessType || 'Service Provider'}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {business.isSuspended ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                        <Ban className="h-3 w-3" /> Suspended
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                        <CheckCircle className="h-3 w-3" /> Approved
                      </span>
                    )}
                    {/* Billing status badge */}
                    {(() => {
                      const meta = SUB_STATUS_META[business.subscriptionStatus ?? 'none'] ?? SUB_STATUS_META.none;
                      return (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border ${meta.cls}`}>
                          <DollarSign className="h-3 w-3" /> {meta.label}
                        </span>
                      );
                    })()}
                    {/* Verification tier badge */}
                    {(() => {
                      const meta = VERIFICATION_META[business.verificationLevel ?? 'UNVERIFIED'] ?? VERIFICATION_META.UNVERIFIED;
                      return (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border ${meta.cls}`}>
                          <UserCheck className="h-3 w-3" /> {meta.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                {business.isSuspended && business.suspensionReason && (
                  <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    <span className="font-medium">Suspension reason:</span> {business.suspensionReason}
                  </div>
                )}
                {/* Verification tier control — updates the provider AND all their listings' badges */}
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Trust tier</span>
                  <select
                    value={business.verificationLevel ?? 'UNVERIFIED'}
                    onChange={(e) => handleSetVerificationLevel(business.id, e.target.value)}
                    disabled={verifyingId === business.id}
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                    aria-label={`Set verification level for ${business.businessName}`}
                  >
                    {VERIFICATION_LEVELS.map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                  {verifyingId === business.id && <span className="text-xs text-muted-foreground">Saving…</span>}
                </div>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" /><span className="truncate">{business.user.email}</span></div>
                    {business.phone && <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" /><span>{business.phone}</span></div>}
                    {(business.city || business.address) && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{business.city && business.state ? `${business.city}, ${business.state}` : business.address || 'Location not specified'}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" /><span>Joined {new Date(business.createdAt).toLocaleDateString()}</span></div>
                    {business.subscriptionStatus === 'trialing' && fmtDate(business.trialEndsAt) && (
                      <div className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4 text-sky-500 flex-shrink-0" /><span>Trial ends {fmtDate(business.trialEndsAt)}</span></div>
                    )}
                    {(business.subscriptionStatus === 'active' || business.subscriptionStatus === 'past_due') && fmtDate(business.currentPeriodEnd) && (
                      <div className="flex items-center gap-2 text-sm"><DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" /><span>Next billing {fmtDate(business.currentPeriodEnd)}</span></div>
                    )}
                    {business._count && (
                      <div className="flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-muted-foreground flex-shrink-0" /><span>{business._count.services} service{business._count.services !== 1 ? 's' : ''} listed</span></div>
                    )}
                    {business.businessDisabilities && business.businessDisabilities.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {business.businessDisabilities.slice(0, 3).map((bd, idx) => (
                          <span key={idx} className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 border border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800">{bd.disability.name}</span>
                        ))}
                        {business.businessDisabilities.length > 3 && (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">+{business.businessDisabilities.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {business.description && <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{business.description}</p>}

                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  <Button variant="outline" size="sm" onClick={() => openActionDialog(business, 'view')} className="flex-1">
                    <Eye className="h-4 w-4 mr-2" /> View Listings
                  </Button>
                  {business.isSuspended ? (
                    <Button variant="outline" size="sm" onClick={() => openActionDialog(business, 'unsuspend')} className="flex-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-800 dark:hover:bg-emerald-950">
                      <RotateCcw className="h-4 w-4 mr-2" /> Reinstate
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => openActionDialog(business, 'suspend')} className="flex-1 text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-800 dark:hover:bg-amber-950">
                      <Ban className="h-4 w-4 mr-2" /> Suspend
                    </Button>
                  )}
                  {EXTENDABLE.has(business.subscriptionStatus ?? 'none') && (
                    <Button variant="outline" size="sm" onClick={() => openActionDialog(business, 'extend_trial')} className="flex-1 text-sky-600 border-sky-200 hover:bg-sky-50 hover:text-sky-700 dark:border-sky-800 dark:hover:bg-sky-950">
                      <Calendar className="h-4 w-4 mr-2" /> Extend Trial
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => openActionDialog(business, 'remove')} className="flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950">
                    <Trash2 className="h-4 w-4 mr-2" /> Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Listings Dialog */}
      <Dialog open={actionType === 'view'} onOpenChange={closeActionDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />{selectedBusiness?.businessName}</DialogTitle>
            <DialogDescription>Business profile and service details</DialogDescription>
          </DialogHeader>

          {selectedBusiness && (
            <div className="py-4 space-y-6">
              <div className="p-4 bg-secondary/40 rounded-lg border border-border">
                <h3 className="font-semibold mb-3 flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />Business Profile</h3>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div><span className="font-medium">Name:</span> {selectedBusiness.businessName}</div>
                  <div><span className="font-medium">Type:</span> {selectedBusiness.businessType || 'N/A'}</div>
                  <div><span className="font-medium">Email:</span> {selectedBusiness.user.email}</div>
                  <div><span className="font-medium">Phone:</span> {selectedBusiness.phone || 'N/A'}</div>
                  {selectedBusiness.city && (
                    <div className="md:col-span-2"><span className="font-medium">Location:</span> {selectedBusiness.address && `${selectedBusiness.address}, `}{selectedBusiness.city}, {selectedBusiness.state} {selectedBusiness.zipCode}</div>
                  )}
                  {selectedBusiness.description && (
                    <div className="md:col-span-2"><span className="font-medium">Description:</span><p className="mt-1 text-muted-foreground">{selectedBusiness.description}</p></div>
                  )}
                </div>
              </div>

              {selectedBusiness.businessDisabilities && selectedBusiness.businessDisabilities.length > 0 && (
                <div className="p-4 bg-accent/30 rounded-lg border border-border">
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Disabilities & Conditions Served</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedBusiness.businessDisabilities.map((bd, idx) => (
                      <span key={idx} className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 border border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800">{bd.disability.name}</span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-4 flex items-center gap-2"><DollarSign className="h-4 w-4" />Service Details</h3>
                {!selectedBusiness.services || selectedBusiness.services.length === 0 ? (
                  <div className="text-center py-8 bg-muted rounded-lg">
                    <p className="text-muted-foreground">No service information available</p>
                    <p className="text-xs text-muted-foreground mt-1">Business has not completed their profile</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedBusiness.services.map((service) => (
                      <Card key={service.id} className="overflow-hidden">
                        <CardHeader className="bg-muted/50 pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg">{service.name || 'Service Information'}</CardTitle>
                              {service.serviceTypes && service.serviceTypes.length > 0 && (
                                <p className="text-sm text-muted-foreground mt-1">{service.serviceTypes.map((st) => st.serviceType.name).join(', ')}</p>
                              )}
                            </div>
                            <a href={`/business/${selectedBusiness.id}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80" title="View public listing">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                          {service.description && (
                            <div><Label className="text-xs font-semibold text-muted-foreground">Description</Label><p className="text-sm mt-1">{service.description}</p></div>
                          )}
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" />Price Range</Label>
                              <p className="text-sm mt-1 font-medium">
                                {service.priceRange ? PRICE_RANGE_LABELS[service.priceRange] || service.priceRange : 'Not specified'}
                                {(service.priceMin != null || service.priceMax != null) && (
                                  <span className="text-muted-foreground"> ({service.priceMin ?? '—'}{service.priceMax != null ? `–${service.priceMax}` : ''})</span>
                                )}
                              </p>
                            </div>
                            <div>
                              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><UserCheck className="h-3 w-3" />Age Groups</Label>
                              <p className="text-sm mt-1">{service.ageGroups && service.ageGroups.length > 0 ? service.ageGroups.join(', ') : 'All ages'}</p>
                            </div>
                          </div>
                          <div className="grid md:grid-cols-2 gap-4">
                            {service.duration && <div><Label className="text-xs font-semibold text-muted-foreground">Duration</Label><p className="text-sm mt-1">{service.duration}</p></div>}
                            {service.frequency && <div><Label className="text-xs font-semibold text-muted-foreground">Frequency</Label><p className="text-sm mt-1">{service.frequency}</p></div>}
                          </div>
                          <div>
                            <Label className="text-xs font-semibold text-muted-foreground">Insurance</Label>
                            <p className="text-sm mt-1">{service.insuranceAccepted ? '✓ Accepted' : 'Not accepted / not specified'}</p>
                          </div>
                          <div className="pt-3 border-t text-xs text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            Listed on {new Date(service.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter><Button onClick={closeActionDialog}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend trial (billing override) dialog */}
      <Dialog open={actionType === 'extend_trial'} onOpenChange={closeActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-sky-600" /> Extend Trial
            </DialogTitle>
            <DialogDescription>
              Sets a new trial end date in Stripe (the source of truth) and re-syncs our records. Use this to comp a
              provider or give them more time. No charge occurs until the trial ends.
            </DialogDescription>
          </DialogHeader>

          {selectedBusiness && (
            <div className="py-4 space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedBusiness.businessName}</p>
                <p className="text-sm text-muted-foreground">{selectedBusiness.user.email}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="trialDate">New trial end date *</Label>
                <Input id="trialDate" type="date" value={trialDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setTrialDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="extendReason">Reason (optional)</Label>
                <Textarea id="extendReason" placeholder="e.g. comped 3 months for early-adopter partner" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="resize-none" />
                <p className="text-xs text-muted-foreground">Recorded in the audit log.</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeActionDialog} disabled={processing}>Cancel</Button>
            <Button onClick={handleExtendTrial} disabled={processing || !trialDate}>
              {processing ? 'Applying…' : 'Extend Trial'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend / Unsuspend / Remove confirmation dialog */}
      <Dialog open={actionType === 'suspend' || actionType === 'remove' || actionType === 'unsuspend'} onOpenChange={closeActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${actionType === 'unsuspend' ? 'text-emerald-600' : 'text-destructive'}`} />
              {actionType === 'suspend' ? 'Suspend Business' : actionType === 'unsuspend' ? 'Reinstate Business' : 'Remove Business'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'suspend' && 'Suspending hides all services and blocks dashboard access. The owner is emailed. This is reversible.'}
              {actionType === 'unsuspend' && 'Reinstating restores public visibility and dashboard access. The owner is emailed.'}
              {actionType === 'remove' && 'This permanently deletes the business profile and all services. This cannot be undone. The owner is emailed.'}
            </DialogDescription>
          </DialogHeader>

          {selectedBusiness && (
            <div className="py-4 space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedBusiness.businessName}</p>
                <p className="text-sm text-muted-foreground">{selectedBusiness.user.email}</p>
              </div>
              {(actionType === 'suspend' || actionType === 'remove') && (
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason for {actionType === 'suspend' ? 'Suspension' : 'Removal'} *</Label>
                  <Textarea
                    id="reason"
                    placeholder={`Explain why this business is being ${actionType === 'suspend' ? 'suspended' : 'removed'}...`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">Recorded in the audit log and included in the email to the owner.</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeActionDialog} disabled={processing}>Cancel</Button>
            <Button
              variant={actionType === 'remove' ? 'destructive' : 'default'}
              onClick={handleAction}
              disabled={processing || ((actionType === 'suspend' || actionType === 'remove') && !reason.trim())}
            >
              {processing ? 'Processing...' : actionType === 'suspend' ? 'Suspend' : actionType === 'unsuspend' ? 'Reinstate' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
