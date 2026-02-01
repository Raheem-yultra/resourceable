'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContactModal } from '@/components/search/ContactModal';

interface BusinessContactCardProps {
  business: {
    id: string;
    userId: string;
    businessName: string;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    address?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  session: any;
  canContact: boolean;
  firstServiceId?: string;
}

export function BusinessContactCard({ business, session, canContact, firstServiceId }: BusinessContactCardProps) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-lg sm:text-xl">Contact Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4 sm:px-6">
        {/* Address */}
        {business.address && (
          <div>
            <h4 className="font-semibold text-sm mb-2">Address</h4>
            <p className="text-sm text-muted-foreground">
              {business.address}
              {business.addressLine2 && (
                <>
                  <br />
                  {business.addressLine2}
                </>
              )}
              <br />
              {business.city}, {business.state} {business.zipCode}
            </p>
          </div>
        )}

        {/* Map Placeholder */}
        {business.latitude && business.longitude && (
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-sm mb-2">📍 Map View</p>
              <p className="text-xs">
                {business.latitude.toFixed(4)}, {business.longitude.toFixed(4)}
              </p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${business.latitude},${business.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-xs mt-2 inline-block"
              >
                Open in Google Maps →
              </a>
            </div>
          </div>
        )}

        {/* Phone */}
        {business.phone && (
          <div>
            <h4 className="font-semibold text-sm mb-2">Phone</h4>
            <a
              href={`tel:${business.phone}`}
              className="text-sm text-primary hover:underline"
            >
              {business.phone}
            </a>
          </div>
        )}

        {/* Email */}
        {business.email && (
          <div>
            <h4 className="font-semibold text-sm mb-2">Email</h4>
            <a
              href={`mailto:${business.email}`}
              className="text-sm text-primary hover:underline break-all"
            >
              {business.email}
            </a>
          </div>
        )}

        {/* Website */}
        {business.website && (
          <div>
            <h4 className="font-semibold text-sm mb-2">Website</h4>
            <a
              href={business.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline break-all"
            >
              {business.website.replace(/^https?:\/\//, '')} →
            </a>
          </div>
        )}

        {/* Contact Buttons */}
        {canContact && (
          <div className="pt-4 space-y-3">
            {/* Send Inquiry Button */}
            <ContactModal
              serviceId={firstServiceId || business.id}
              businessId={business.id}
              businessUserId={business.userId}
              businessName={business.businessName}
              phone={business.phone || undefined}
              email={business.email || undefined}
              website={business.website || undefined}
            >
              <Button variant="default" className="w-full min-h-[48px] text-sm sm:text-base" size="lg">
                📝 Send Inquiry
              </Button>
            </ContactModal>

            {/* Direct Message Button */}
            <Button
              variant="outline"
              className="w-full min-h-[48px] text-sm sm:text-base"
              size="lg"
              onClick={() => {
                router.push(`/messages/${business.userId}?message=Hi! I'm interested in learning more about your services.`);
              }}
            >
              💬 Send Direct Message
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Send an inquiry or start a direct conversation
            </p>
          </div>
        )}

        {!session && (
          <div className="pt-4 space-y-3">
            <ContactModal
              serviceId={firstServiceId || business.id}
              businessId={business.id}
              businessUserId={business.userId}
              businessName={business.businessName}
              phone={business.phone || undefined}
              email={business.email || undefined}
              website={business.website || undefined}
            >
              <Button variant="default" className="w-full min-h-[48px] text-sm sm:text-base" size="lg">
                📝 Send Inquiry
              </Button>
            </ContactModal>
            <p className="text-xs text-center text-muted-foreground">
              or <Link href="/auth/signin" className="text-primary hover:underline">sign in</Link> to message directly
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
