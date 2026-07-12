'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { ContactModal } from '@/components/search/ContactModal';
import { Mail, MessageCircle } from 'lucide-react';

/**
 * Contact actions on the listing detail page: an inquiry form (ContactModal, which
 * also surfaces phone/email/website) plus a first-class "Message directly" button.
 * Signed-in families go straight to the real-time thread; guests are routed to
 * sign in first.
 */
export function ListingContactActions({
  serviceId,
  businessId,
  businessUserId,
  businessName,
  listingName,
  phone,
  email,
  website,
}: {
  serviceId: string;
  businessId: string;
  businessUserId: string;
  businessName: string;
  listingName: string;
  phone?: string;
  email?: string;
  website?: string;
}) {
  const { data: session } = useSession();
  const prefill = `Hi! I'm interested in your listing "${listingName}".`;
  const messageHref = `/messages/${businessUserId}?message=${encodeURIComponent(prefill)}`;

  return (
    <div className="rounded-lg border bg-card p-4 sm:p-5">
      <h2 className="font-semibold mb-1">Interested in this listing?</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Send {businessName} an inquiry, or message them directly.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <ContactModal
          serviceId={serviceId}
          businessId={businessId}
          businessUserId={businessUserId}
          businessName={businessName}
          phone={phone}
          email={email}
          website={website}
        >
          <Button className="flex-1 min-h-[48px] gap-2">
            <Mail className="h-4 w-4" aria-hidden="true" /> Contact provider
          </Button>
        </ContactModal>

        {session ? (
          <Button asChild variant="outline" className="flex-1 min-h-[48px] gap-2">
            <Link href={messageHref}>
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> Message directly
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline" className="flex-1 min-h-[48px] gap-2">
            <Link href="/auth/signin">
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> Sign in to message
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
