'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Building2, Mail, Phone, MapPin, Globe, Calendar, DollarSign, Users,
  CheckCircle, XCircle, ChevronDown, ChevronUp, FileText, Search,
} from 'lucide-react';
import {
  VerificationSignals,
  VerificationVerdictBadge,
  type VerificationCheckView,
} from '@/components/admin/VerificationSignals';

interface Business {
  id: string;
  businessName: string;
  businessType?: string;
  description?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  yearEstablished?: number;
  licenseNumber?: string;
  npi?: string;
  checksRunAt?: string | null;
  verificationStatus: string;
  createdAt: string;
  user: { id: string; email: string; name?: string; createdAt: string };
  services?: Array<{ id: string; name: string; description: string }>;
  businessDisabilities?: Array<{ disability: { name: string; slug: string } }>;
  verificationChecks?: VerificationCheckView[];
}

type StatusFilter = 'PENDING' | 'APPROVED' | 'REJECTED';

export function AdminBusinessVerification() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Search / date-range filters
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState<false | 'approve' | 'reject'>(false);
  const [bulkReason, setBulkReason] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const params = new URLSearchParams({ status: statusFilter });
      if (appliedSearch) params.set('search', appliedSearch);
      if (dateFrom) params.set('dateFrom', new Date(dateFrom).toISOString());
      if (dateTo) params.set('dateTo', new Date(`${dateTo}T23:59:59`).toISOString());
      const response = await fetch(`/api/admin/businesses/pending?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setBusinesses(data.businesses);
      }
    } catch (error) {
      console.error('Failed to fetch businesses:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, appliedSearch, dateFrom, dateTo]);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  const toggleCard = (businessId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      next.has(businessId) ? next.delete(businessId) : next.add(businessId);
      return next;
    });
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allSelected = businesses.length > 0 && selected.size === businesses.length;
  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(businesses.map((b) => b.id)));
  };

  const handleVerification = async (businessId: string, status: 'APPROVED' | 'REJECTED') => {
    if (status === 'REJECTED' && !rejectionReasons[businessId]?.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    setProcessingIds((prev) => new Set(prev).add(businessId));
    try {
      const response = await fetch(`/api/admin/businesses/${businessId}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          rejectionReason: status === 'REJECTED' ? rejectionReasons[businessId] : undefined,
          adminNotes: adminNotes[businessId] || undefined,
        }),
      });
      if (response.ok) {
        setBusinesses((prev) => prev.filter((b) => b.id !== businessId));
        setBanner(`Business ${status.toLowerCase()} successfully.`);
      } else {
        const data = await response.json();
        alert(`Failed to update: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to update verification status:', error);
      alert('Failed to update verification status');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(businessId);
        return next;
      });
    }
  };

  // Bulk approve/reject — server logs each item individually
  const runBulk = async () => {
    if (!bulkOpen) return;
    if (bulkOpen === 'reject' && !bulkReason.trim()) {
      alert('A reason is required to bulk-reject.');
      return;
    }
    setBulkProcessing(true);
    try {
      const response = await fetch('/api/admin/businesses/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: bulkOpen,
          ids: Array.from(selected),
          reason: bulkOpen === 'reject' ? bulkReason.trim() : undefined,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        const failedIds = new Set((data.results || []).filter((r: any) => !r.ok).map((r: any) => r.id));
        setBusinesses((prev) => prev.filter((b) => failedIds.has(b.id) || !selected.has(b.id)));
        setBanner(data.message);
        setBulkOpen(false);
        setBulkReason('');
        setSelected(new Set());
      } else {
        alert(data.error || 'Bulk action failed');
      }
    } catch (error) {
      console.error('Bulk action failed:', error);
      alert('Bulk action failed');
    } finally {
      setBulkProcessing(false);
    }
  };

  // Splice re-run results back into the row without refetching the whole queue.
  const applyChecks = (businessId: string, checks: VerificationCheckView[]) => {
    setBusinesses((prev) =>
      prev.map((b) =>
        b.id === businessId ? { ...b, verificationChecks: checks, checksRunAt: new Date().toISOString() } : b
      )
    );
  };

  const clearFilters = () => {
    setSearchInput('');
    setAppliedSearch('');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex gap-2 border-b pb-2">
        {(['PENDING', 'APPROVED', 'REJECTED'] as StatusFilter[]).map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? (s === 'REJECTED' ? 'destructive' : 'default') : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter(s)}
            className="min-h-[40px] capitalize"
          >
            {s.toLowerCase()}
            {statusFilter === s ? ` (${businesses.length})` : ''}
          </Button>
        ))}
      </div>

      {banner && (
        <div className="flex items-center justify-between rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" role="status">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)} aria-label="Dismiss"><XCircle className="h-4 w-4" /></button>
        </div>
      )}

      {/* Filter toolbar */}
      <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <Label htmlFor="verify-search" className="text-xs">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="verify-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setAppliedSearch(searchInput.trim())}
              placeholder="Name, email, or city"
              className="pl-8"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="verify-from" className="text-xs">From</Label>
          <Input id="verify-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="verify-to" className="text-xs">To</Label>
          <Input id="verify-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setAppliedSearch(searchInput.trim())}>Apply</Button>
          <Button size="sm" variant="ghost" onClick={clearFilters}>Clear</Button>
        </div>
      </div>

      {/* Bulk action bar (pending only) */}
      {statusFilter === 'PENDING' && businesses.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="h-4 w-4" />
            Select all
          </label>
          <span className="text-sm text-muted-foreground">{selected.size} selected</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" disabled={selected.size === 0} onClick={() => setBulkOpen('approve')}>
              <CheckCircle className="mr-1 h-4 w-4" /> Approve selected
            </Button>
            <Button size="sm" variant="destructive" disabled={selected.size === 0} onClick={() => setBulkOpen('reject')}>
              <XCircle className="mr-1 h-4 w-4" /> Reject selected
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg border bg-muted/40" />
          ))}
        </div>
      ) : businesses.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No {statusFilter.toLowerCase()} businesses{appliedSearch || dateFrom || dateTo ? ' match your filters' : ''}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {businesses.map((business) => {
            const isExpanded = expandedCards.has(business.id);
            const isProcessing = processingIds.has(business.id);

            return (
              <Card key={business.id} className="overflow-hidden">
                <CardHeader className="bg-muted/50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {statusFilter === 'PENDING' && (
                        <input
                          type="checkbox"
                          checked={selected.has(business.id)}
                          onChange={() => toggleSelected(business.id)}
                          className="h-4 w-4"
                          aria-label={`Select ${business.businessName}`}
                        />
                      )}
                      <Building2 className="h-6 w-6 text-primary" />
                      <div>
                        <CardTitle className="text-xl">{business.businessName}</CardTitle>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <p className="text-sm text-muted-foreground">{business.businessType || 'Service Provider'}</p>
                          {/* Always visible so the queue is triageable without expanding rows */}
                          <VerificationVerdictBadge checks={business.verificationChecks || []} />
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => toggleCard(business.id)} aria-label={isExpanded ? 'Collapse' : 'Expand'}>
                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="pt-6 space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Contact:</span>
                      <span>{business.user.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Registered:</span>
                      <span>{new Date(business.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <>
                      {/* Evidence first — the admin's job is to adjudicate exceptions,
                          not to re-read the self-reported fields below. */}
                      <VerificationSignals
                        businessId={business.id}
                        checks={business.verificationChecks || []}
                        checksRunAt={business.checksRunAt}
                        onUpdated={(checks) => applyChecks(business.id, checks)}
                      />

                      {business.description && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <Label className="text-base font-semibold">Business Description</Label>
                          </div>
                          <p className="text-sm text-muted-foreground pl-6">{business.description}</p>
                        </div>
                      )}

                      <div className="space-y-3">
                        <Label className="text-base font-semibold">Contact Information</Label>
                        <div className="grid md:grid-cols-2 gap-3 pl-6">
                          {business.phone && (
                            <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /><span>{business.phone}</span></div>
                          )}
                          {business.email && (
                            <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /><span>{business.email}</span></div>
                          )}
                          {business.website && (
                            <div className="flex items-center gap-2 text-sm">
                              <Globe className="h-4 w-4 text-muted-foreground" />
                              <a href={business.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{business.website}</a>
                            </div>
                          )}
                        </div>
                      </div>

                      {(business.address || business.city) && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /><Label className="text-base font-semibold">Location</Label></div>
                          <div className="text-sm text-muted-foreground pl-6">
                            {business.address && <p>{business.address}</p>}
                            {business.addressLine2 && <p>{business.addressLine2}</p>}
                            {business.city && <p>{business.city}, {business.state} {business.zipCode}</p>}
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        <Label className="text-base font-semibold">Business Details</Label>
                        <div className="grid md:grid-cols-2 gap-3 pl-6 text-sm">
                          {business.yearEstablished && <div><span className="font-medium">Year Established:</span> {business.yearEstablished}</div>}
                          {business.licenseNumber && <div><span className="font-medium">License #:</span> {business.licenseNumber}</div>}
                          {business.npi && (
                            <div>
                              <span className="font-medium">NPI:</span>{' '}
                              <a
                                href={`https://npiregistry.cms.hhs.gov/provider-view/${business.npi}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {business.npi}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      {business.businessDisabilities && business.businessDisabilities.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><Label className="text-base font-semibold">Disabilities Served</Label></div>
                          <div className="flex flex-wrap gap-2 pl-6">
                            {business.businessDisabilities.map((bd) => (
                              <span key={bd.disability.slug} className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 border border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800">
                                {bd.disability.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {business.services && business.services.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" /><Label className="text-base font-semibold">Services Offered</Label></div>
                          <div className="space-y-2 pl-6">
                            {business.services.map((service) => (
                              <div key={service.id} className="border-l-2 border-primary pl-3">
                                <p className="font-medium text-sm">{service.name}</p>
                                {service.description && <p className="text-xs text-muted-foreground mt-1">{service.description}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {statusFilter === 'PENDING' && (
                        <div className="space-y-4 border-t pt-4">
                          <div className="space-y-2">
                            <Label htmlFor={`notes-${business.id}`}>Admin Notes (Optional)</Label>
                            <Textarea
                              id={`notes-${business.id}`}
                              placeholder="Internal notes about this business..."
                              value={adminNotes[business.id] || ''}
                              onChange={(e) => setAdminNotes({ ...adminNotes, [business.id]: e.target.value })}
                              rows={2}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`rejection-${business.id}`}>Rejection Reason (Required if rejecting)</Label>
                            <Textarea
                              id={`rejection-${business.id}`}
                              placeholder="Explain why this business is being rejected..."
                              value={rejectionReasons[business.id] || ''}
                              onChange={(e) => setRejectionReasons({ ...rejectionReasons, [business.id]: e.target.value })}
                              rows={3}
                            />
                          </div>
                          <div className="flex gap-3">
                            <Button variant="default" className="flex-1" onClick={() => handleVerification(business.id, 'APPROVED')} disabled={isProcessing}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              {isProcessing ? 'Processing...' : 'Approve Business'}
                            </Button>
                            <Button variant="destructive" className="flex-1" onClick={() => handleVerification(business.id, 'REJECTED')} disabled={isProcessing}>
                              <XCircle className="h-4 w-4 mr-2" />
                              {isProcessing ? 'Processing...' : 'Reject Business'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Bulk confirmation dialog */}
      <Dialog open={bulkOpen !== false} onOpenChange={(o) => !o && setBulkOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{bulkOpen === 'approve' ? 'Approve' : 'Reject'} {selected.size} business{selected.size !== 1 ? 'es' : ''}?</DialogTitle>
            <DialogDescription>
              Each business will be {bulkOpen === 'approve' ? 'approved' : 'rejected'} and logged individually in the audit trail. This cannot be undone in bulk.
            </DialogDescription>
          </DialogHeader>
          {bulkOpen === 'reject' && (
            <div className="space-y-2 py-2">
              <Label htmlFor="bulk-reason">Rejection reason (applied to all selected) *</Label>
              <Textarea id="bulk-reason" value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} rows={3} placeholder="Reason sent/recorded for each rejected business..." />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkProcessing}>Cancel</Button>
            <Button
              variant={bulkOpen === 'reject' ? 'destructive' : 'default'}
              onClick={runBulk}
              disabled={bulkProcessing || (bulkOpen === 'reject' && !bulkReason.trim())}
            >
              {bulkProcessing ? 'Processing…' : `Confirm ${bulkOpen === 'approve' ? 'approve' : 'reject'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
