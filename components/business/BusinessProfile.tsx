'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Business {
  id: string;
  businessName: string;
  description?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  verificationStatus: string;
  services?: Service[];
}

interface Service {
  id: string;
  name: string;
  description: string;
  serviceTypes: string[];
  disabilityTypes: string[];
}

interface BusinessProfileProps {
  business: Business;
  onContactClick?: () => void;
}

export function BusinessProfile({ business, onContactClick }: BusinessProfileProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-3xl">{business.businessName}</CardTitle>
              {business.verificationStatus === 'APPROVED' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 mt-2">
                  ✓ Verified
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {business.description && (
            <div>
              <h3 className="font-semibold mb-2">About</h3>
              <p className="text-muted-foreground">{business.description}</p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {business.address && (
              <div>
                <h3 className="font-semibold mb-1">Address</h3>
                <p className="text-sm text-muted-foreground">
                  {business.address}
                  <br />
                  {business.city}, {business.state} {business.zipCode}
                </p>
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-1">Contact</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                {business.phone && <p>Phone: {business.phone}</p>}
                {business.email && <p>Email: {business.email}</p>}
                {business.website && (
                  <p>
                    <a
                      href={business.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Visit Website
                    </a>
                  </p>
                )}
              </div>
            </div>
          </div>

          {onContactClick && (
            <Button onClick={onContactClick} className="w-full">
              Send Message
            </Button>
          )}
        </CardContent>
      </Card>

      {business.services && business.services.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Services Offered</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {business.services.map((service) => (
              <div key={service.id} className="border-b pb-4 last:border-0">
                <h3 className="font-semibold mb-2">{service.name}</h3>
                <p className="text-sm text-muted-foreground mb-2">{service.description}</p>
                <div className="flex flex-wrap gap-2">
                  {service.disabilityTypes.map((type) => (
                    <span
                      key={type}
                      className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                    >
                      {type.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
