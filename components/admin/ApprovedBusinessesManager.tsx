'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Users,
  Search,
  Ban,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Eye,
  ExternalLink,
  DollarSign,
  Clock,
  UserCheck
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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
  createdAt: string;
  user: {
    id: string;
    email: string;
    name?: string;
  };
  services?: Array<{
    id: string;
    name: string;
    description?: string;
    price?: number;
    priceRange?: string;
    serviceTypes?: Array<{
      serviceType: {
        name: string;
      };
    }>;
    ageGroups?: string[];
    availabilityHours?: string;
    location?: string;
    virtualOption?: boolean;
    inPersonOption?: boolean;
    createdAt: string;
  }>;
  businessDisabilities?: Array<{
    disability: {
      name: string;
    };
  }>;
  _count?: {
    services: number;
  };
}

export function ApprovedBusinessesManager() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'remove' | 'view' | null>(null);
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchApprovedBusinesses();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredBusinesses(businesses);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredBusinesses(
        businesses.filter(
          (b) =>
            b.businessName.toLowerCase().includes(query) ||
            b.user.email.toLowerCase().includes(query) ||
            b.city?.toLowerCase().includes(query) ||
            b.state?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, businesses]);

  const fetchApprovedBusinesses = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/businesses/approved');
      if (response.ok) {
        const data = await response.json();
        setBusinesses(data.businesses);
        setFilteredBusinesses(data.businesses);
      }
    } catch (error) {
      console.error('Failed to fetch approved businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const openActionDialog = (business: Business, action: 'suspend' | 'remove' | 'view') => {
    setSelectedBusiness(business);
    setActionType(action);
    setReason('');
  };

  const closeActionDialog = () => {
    setSelectedBusiness(null);
    setActionType(null);
    setReason('');
  };

  const handleAction = async () => {
    if (!selectedBusiness || !actionType) return;
    
    if (!reason.trim()) {
      alert('Please provide a reason for this action');
      return;
    }

    setProcessing(true);

    try {
      const endpoint = actionType === 'suspend' 
        ? `/api/admin/businesses/${selectedBusiness.id}/suspend`
        : `/api/admin/businesses/${selectedBusiness.id}/remove`;

      const response = await fetch(endpoint, {
        method: actionType === 'suspend' ? 'PATCH' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (response.ok) {
        // Remove from list
        setBusinesses(businesses.filter(b => b.id !== selectedBusiness.id));
        alert(`Business ${actionType === 'suspend' ? 'suspended' : 'removed'} successfully!`);
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
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Approved Businesses</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredBusinesses.length} active business{filteredBusinesses.length !== 1 ? 'es' : ''} on the platform
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Businesses Grid */}
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
            <Card key={business.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Building2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-1">{business.businessName}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {business.businessType || 'Service Provider'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Approved
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{business.user.email}</span>
                    </div>
                    {business.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span>{business.phone}</span>
                      </div>
                    )}
                    {(business.city || business.address) && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">
                          {business.city && business.state
                            ? `${business.city}, ${business.state}`
                            : business.address || 'Location not specified'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span>Joined {new Date(business.createdAt).toLocaleDateString()}</span>
                    </div>
                    {business._count && (
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span>{business._count.services} service{business._count.services !== 1 ? 's' : ''} listed</span>
                      </div>
                    )}
                    {business.businessDisabilities && business.businessDisabilities.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {business.businessDisabilities.slice(0, 3).map((bd, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 border border-purple-200"
                          >
                            {bd.disability.name}
                          </span>
                        ))}
                        {business.businessDisabilities.length > 3 && (
                          <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600">
                            +{business.businessDisabilities.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {business.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {business.description}
                  </p>
                )}

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openActionDialog(business, 'view')}
                    className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Listings
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openActionDialog(business, 'suspend')}
                    className="flex-1 text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Suspend
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openActionDialog(business, 'remove')}
                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Listings Dialog */}
      <Dialog open={actionType === 'view'} onOpenChange={closeActionDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              {selectedBusiness?.businessName} - Business Listing Details
            </DialogTitle>
            <DialogDescription>
              Complete business profile and service information
            </DialogDescription>
          </DialogHeader>

          {selectedBusiness && (
            <div className="py-4 space-y-6">
              {/* Business Summary */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Business Profile
                </h3>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div><span className="font-medium">Name:</span> {selectedBusiness.businessName}</div>
                  <div><span className="font-medium">Type:</span> {selectedBusiness.businessType || 'N/A'}</div>
                  <div><span className="font-medium">Email:</span> {selectedBusiness.user.email}</div>
                  <div><span className="font-medium">Phone:</span> {selectedBusiness.phone || 'N/A'}</div>
                  {selectedBusiness.city && (
                    <div className="md:col-span-2">
                      <span className="font-medium">Location:</span> {selectedBusiness.address && `${selectedBusiness.address}, `}{selectedBusiness.city}, {selectedBusiness.state} {selectedBusiness.zipCode}
                    </div>
                  )}
                  {selectedBusiness.description && (
                    <div className="md:col-span-2">
                      <span className="font-medium">Description:</span>
                      <p className="mt-1 text-muted-foreground">{selectedBusiness.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Disabilities Served */}
              {selectedBusiness.businessDisabilities && selectedBusiness.businessDisabilities.length > 0 && (
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-600" />
                    Disabilities & Conditions Served
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedBusiness.businessDisabilities.map((bd, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center rounded-full bg-white px-3 py-1 text-sm font-medium text-purple-700 border border-purple-300"
                      >
                        {bd.disability.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Service Details */}
              <div>
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Service Details & Information
                </h3>

                {!selectedBusiness.services || selectedBusiness.services.length === 0 ? (
                  <div className="text-center py-8 bg-muted rounded-lg">
                    <p className="text-muted-foreground">No service information available</p>
                    <p className="text-xs text-muted-foreground mt-1">Business has not completed their profile</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedBusiness.services.map((service, idx) => (
                      <Card key={service.id} className="overflow-hidden">
                        <CardHeader className="bg-muted/50 pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg flex items-center gap-2">
                                {service.name || 'Service Information'}
                              </CardTitle>
                              {service.serviceTypes && service.serviceTypes.length > 0 && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {service.serviceTypes.map(st => st.serviceType.name).join(', ')}
                                </p>
                              )}
                            </div>
                            <a
                              href={`/business/${selectedBusiness.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700"
                              title="View public listing"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <div className="space-y-4">
                            {/* Description */}
                            {service.description && (
                              <div>
                                <Label className="text-xs font-semibold text-muted-foreground">Description</Label>
                                <p className="text-sm mt-1">{service.description}</p>
                              </div>
                            )}

                            {/* Pricing */}
                            <div className="grid md:grid-cols-2 gap-4">
                              <div>
                                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  Price Range
                                </Label>
                                <p className="text-sm mt-1 font-medium">
                                  {service.priceRange || 'Not specified'}
                                  {service.price && ` ($${service.price})`}
                                </p>
                              </div>

                              <div>
                                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                  <UserCheck className="h-3 w-3" />
                                  Age Groups Served
                                </Label>
                                <p className="text-sm mt-1">
                                  {service.ageGroups && service.ageGroups.length > 0
                                    ? service.ageGroups.join(', ')
                                    : 'All ages'}
                                </p>
                              </div>
                            </div>

                            {/* Service Delivery Options */}
                            <div>
                              <Label className="text-xs font-semibold text-muted-foreground">Service Delivery Options</Label>
                              <div className="flex gap-2 mt-1">
                                {service.inPersonOption && (
                                  <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 border border-green-200">
                                    ✓ In-Person
                                  </span>
                                )}
                                {service.virtualOption && (
                                  <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 border border-blue-200">
                                    ✓ Virtual/Online
                                  </span>
                                )}
                                {!service.inPersonOption && !service.virtualOption && (
                                  <span className="text-sm text-muted-foreground">Not specified</span>
                                )}
                              </div>
                            </div>

                            {/* Location & Availability */}
                            <div className="grid md:grid-cols-2 gap-4">
                              {service.location && (
                                <div>
                                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    Service Location
                                  </Label>
                                  <p className="text-sm mt-1">{service.location}</p>
                                </div>
                              )}

                              {service.availabilityHours && (
                                <div>
                                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Availability
                                  </Label>
                                  <p className="text-sm mt-1">{service.availabilityHours}</p>
                                </div>
                              )}
                            </div>

                            {/* Posted Date */}
                            <div className="pt-3 border-t text-xs text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                Listed on {new Date(service.createdAt).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    
                    {selectedBusiness.services.length > 1 && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                        <p className="font-medium text-yellow-800">⚠️ Multiple Service Records</p>
                        <p className="text-yellow-700 text-xs mt-1">
                          This business has {selectedBusiness.services.length} separate service entries. 
                          Consider consolidating into one comprehensive listing.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={closeActionDialog}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog open={actionType === 'suspend' || actionType === 'remove'} onOpenChange={closeActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              {actionType === 'suspend' ? 'Suspend Business' : 'Remove Business'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'suspend' 
                ? 'Suspending this business will hide all their services and prevent them from accessing their dashboard. They will receive an email notification.'
                : 'This will permanently delete the business profile and all associated services. This action cannot be undone. The business owner will receive an email notification.'}
            </DialogDescription>
          </DialogHeader>

          {selectedBusiness && (
            <div className="py-4 space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedBusiness.businessName}</p>
                <p className="text-sm text-muted-foreground">{selectedBusiness.user.email}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">
                  Reason for {actionType === 'suspend' ? 'Suspension' : 'Removal'} *
                </Label>
                <Textarea
                  id="reason"
                  placeholder={`Explain why this business is being ${actionType === 'suspend' ? 'suspended' : 'removed'}...`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  This reason will be included in the email notification sent to the business owner.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeActionDialog} disabled={processing}>
              Cancel
            </Button>
            <Button
              variant={actionType === 'remove' ? 'destructive' : 'default'}
              onClick={handleAction}
              disabled={processing || !reason.trim()}
            >
              {processing 
                ? 'Processing...' 
                : actionType === 'suspend' 
                  ? 'Suspend Business' 
                  : 'Remove Business'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
