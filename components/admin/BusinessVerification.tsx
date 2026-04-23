'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Globe, 
  Calendar, 
  DollarSign, 
  Users,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';

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
  verificationStatus: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name?: string;
    createdAt: string;
  };
  services?: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  businessDisabilities?: Array<{
    disability: {
      name: string;
      slug: string;
    };
  }>;
}

export function AdminBusinessVerification() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchBusinesses();
  }, [statusFilter]);

  const fetchBusinesses = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/businesses/pending?status=${statusFilter}`);
      if (response.ok) {
        const data = await response.json();
        setBusinesses(data.businesses);
      }
    } catch (error) {
      console.error('Failed to fetch businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCard = (businessId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(businessId)) {
      newExpanded.delete(businessId);
    } else {
      newExpanded.add(businessId);
    }
    setExpandedCards(newExpanded);
  };

  const handleVerification = async (businessId: string, status: 'APPROVED' | 'REJECTED') => {
    if (status === 'REJECTED' && !rejectionReasons[businessId]?.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    setProcessingIds(new Set(processingIds).add(businessId));

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
        // Remove from current list
        setBusinesses(businesses.filter(b => b.id !== businessId));
        // Clear form data
        const newReasons = { ...rejectionReasons };
        const newNotes = { ...adminNotes };
        delete newReasons[businessId];
        delete newNotes[businessId];
        setRejectionReasons(newReasons);
        setAdminNotes(newNotes);
        
        alert(`Business ${status.toLowerCase()} successfully!`);
      } else {
        const data = await response.json();
        alert(`Failed to update: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to update verification status:', error);
      alert('Failed to update verification status');
    } finally {
      const newProcessing = new Set(processingIds);
      newProcessing.delete(businessId);
      setProcessingIds(newProcessing);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setStatusFilter('PENDING')}
          className={`px-4 py-2 font-medium transition-colors ${
            statusFilter === 'PENDING'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Pending ({businesses.length})
        </button>
        <button
          onClick={() => setStatusFilter('APPROVED')}
          className={`px-4 py-2 font-medium transition-colors ${
            statusFilter === 'APPROVED'
              ? 'border-b-2 border-green-600 text-green-600'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Approved
        </button>
        <button
          onClick={() => setStatusFilter('REJECTED')}
          className={`px-4 py-2 font-medium transition-colors ${
            statusFilter === 'REJECTED'
              ? 'border-b-2 border-red-600 text-red-600'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Rejected
        </button>
      </div>

      {businesses.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No {statusFilter.toLowerCase()} businesses found.
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-6 w-6 text-primary" />
                      <div>
                        <CardTitle className="text-xl">{business.businessName}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {business.businessType || 'Service Provider'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCard(business.id)}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="pt-6 space-y-6">
                  {/* Quick Info - Always Visible */}
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

                  {/* Expanded Details */}
                  {isExpanded && (
                    <>
                      {/* Business Description */}
                      {business.description && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <Label className="text-base font-semibold">Business Description</Label>
                          </div>
                          <p className="text-sm text-muted-foreground pl-6">{business.description}</p>
                        </div>
                      )}

                      {/* Contact Information */}
                      <div className="space-y-3">
                        <Label className="text-base font-semibold">Contact Information</Label>
                        <div className="grid md:grid-cols-2 gap-3 pl-6">
                          {business.phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span>{business.phone}</span>
                            </div>
                          )}
                          {business.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span>{business.email}</span>
                            </div>
                          )}
                          {business.website && (
                            <div className="flex items-center gap-2 text-sm">
                              <Globe className="h-4 w-4 text-muted-foreground" />
                              <a 
                                href={business.website} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {business.website}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Location */}
                      {(business.address || business.city) && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            <Label className="text-base font-semibold">Location</Label>
                          </div>
                          <div className="text-sm text-muted-foreground pl-6">
                            {business.address && <p>{business.address}</p>}
                            {business.addressLine2 && <p>{business.addressLine2}</p>}
                            {business.city && (
                              <p>
                                {business.city}, {business.state} {business.zipCode}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Business Details */}
                      <div className="space-y-3">
                        <Label className="text-base font-semibold">Business Details</Label>
                        <div className="grid md:grid-cols-2 gap-3 pl-6 text-sm">
                          {business.yearEstablished && (
                            <div>
                              <span className="font-medium">Year Established:</span>{' '}
                              {business.yearEstablished}
                            </div>
                          )}
                          {business.licenseNumber && (
                            <div>
                              <span className="font-medium">License #:</span>{' '}
                              {business.licenseNumber}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Disabilities Served */}
                      {business.businessDisabilities && business.businessDisabilities.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            <Label className="text-base font-semibold">Disabilities Served</Label>
                          </div>
                          <div className="flex flex-wrap gap-2 pl-6">
                            {business.businessDisabilities.map((bd) => (
                              <span
                                key={bd.disability.slug}
                                className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 border border-sky-200"
                              >
                                {bd.disability.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Services */}
                      {business.services && business.services.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-primary" />
                            <Label className="text-base font-semibold">Services Offered</Label>
                          </div>
                          <div className="space-y-2 pl-6">
                            {business.services.map((service) => (
                              <div key={service.id} className="border-l-2 border-primary pl-3">
                                <p className="font-medium text-sm">{service.name}</p>
                                {service.description && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {service.description}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Admin Actions - Only show for PENDING */}
                      {statusFilter === 'PENDING' && (
                        <div className="space-y-4 border-t pt-4">
                          <div className="space-y-2">
                            <Label htmlFor={`notes-${business.id}`}>Admin Notes (Optional)</Label>
                            <Textarea
                              id={`notes-${business.id}`}
                              placeholder="Internal notes about this business..."
                              value={adminNotes[business.id] || ''}
                              onChange={(e) =>
                                setAdminNotes({ ...adminNotes, [business.id]: e.target.value })
                              }
                              rows={2}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`rejection-${business.id}`}>
                              Rejection Reason (Required if rejecting)
                            </Label>
                            <Textarea
                              id={`rejection-${business.id}`}
                              placeholder="Explain why this business is being rejected..."
                              value={rejectionReasons[business.id] || ''}
                              onChange={(e) =>
                                setRejectionReasons({
                                  ...rejectionReasons,
                                  [business.id]: e.target.value,
                                })
                              }
                              rows={3}
                            />
                          </div>

                          <div className="flex gap-3">
                            <Button
                              variant="default"
                              className="flex-1"
                              onClick={() => handleVerification(business.id, 'APPROVED')}
                              disabled={isProcessing}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              {isProcessing ? 'Processing...' : 'Approve Business'}
                            </Button>
                            <Button
                              variant="destructive"
                              className="flex-1"
                              onClick={() => handleVerification(business.id, 'REJECTED')}
                              disabled={isProcessing}
                            >
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
    </div>
  );
}
