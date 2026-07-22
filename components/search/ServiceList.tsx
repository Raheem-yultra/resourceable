'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  MapPin, Star, CheckCircle, Heart, Search, Loader2, ShieldCheck, ShieldQuestion,
  Stethoscope, HeartHandshake, ShoppingBag, GraduationCap, CalendarDays,
  Package, Video, CalendarClock, Users,
} from 'lucide-react';
import { useState } from 'react';
import { ContactModal } from './ContactModal';
import { ReportButton } from '@/components/listing/ReportButton';
import { listingTypeMeta } from '@/lib/listing-taxonomy';

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Stethoscope, HeartHandshake, ShoppingBag, GraduationCap, CalendarDays,
};
const CONDITION_LABELS: Record<string, string> = {
  NEW: 'New',
  USED_LIKE_NEW: 'Like new',
  USED_FAIR: 'Used',
};
const DELIVERY_LABELS: Record<string, string> = {
  IN_PERSON: 'In-person',
  VIRTUAL: 'Virtual',
  BOTH: 'In-person or virtual',
};

interface Service {
  id: string;
  name: string;
  description: string;
  listingType?: string;
  verificationLevel?: string;
  deliveryMode?: string | null;
  condition?: string | null;
  isForRent?: boolean;
  brand?: string | null;
  isVirtual?: boolean;
  enrollmentStatus?: string | null;
  programType?: string | null;
  rsvpCount?: number;
  capacity?: number | null;
  startDate?: string | null;
  serviceTypes: Array<{
    id: string;
    name: string;
    slug: string;
    category?: string;
  }>;
  disabilities: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  priceMin?: number;
  priceMax?: number;
  averageRating?: number | null;
  totalReviews?: number;
  rating?: number;
  reviewCount?: number;
  distance?: number;
  business: {
    id: string;
    userId: string;
    businessName: string;
    city?: string;
    state?: string;
    zipCode?: string;
    verificationStatus?: string;
    averageRating?: number;
    totalReviews?: number;
    phone?: string;
    email?: string;
    website?: string;
  };
}

/** Verification tier badge shown on every card (plan §4/§7.9). */
function VerificationBadge({ level }: { level?: string }) {
  if (level === 'LICENSED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-600/10 text-green-700 dark:text-green-400 border border-green-600/30 px-2 py-0.5 text-xs font-medium" title="Licensed & verified provider">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Licensed
      </span>
    );
  }
  if (level === 'BASIC_VERIFIED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 text-xs font-medium" title="Verified provider">
        <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" /> Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground border border-border px-2 py-0.5 text-xs font-medium" title="This provider has not yet been verified">
      <ShieldQuestion className="h-3.5 w-3.5" aria-hidden="true" /> Unverified
    </span>
  );
}

/** Type-specific secondary info line (plan §7.5). */
function TypeInfoLine({ service }: { service: Service }) {
  const items: Array<{ icon: React.ComponentType<{ className?: string }>; text: string }> = [];
  switch (service.listingType) {
    case 'SHOP':
      if (service.condition) items.push({ icon: Package, text: CONDITION_LABELS[service.condition] || service.condition });
      items.push({ icon: ShoppingBag, text: service.isForRent ? 'For rent' : 'For sale' });
      break;
    case 'EVENT': {
      if (service.startDate) {
        const d = new Date(service.startDate);
        items.push({ icon: CalendarClock, text: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) });
      }
      if (service.capacity != null) {
        const left = Math.max(0, service.capacity - (service.rsvpCount || 0));
        items.push({ icon: Users, text: `${left} spot${left !== 1 ? 's' : ''} left` });
      }
      if (service.isVirtual) items.push({ icon: Video, text: 'Virtual' });
      break;
    }
    case 'SCHOOL':
      if (service.enrollmentStatus) items.push({ icon: GraduationCap, text: service.enrollmentStatus });
      if (service.programType) items.push({ icon: Package, text: service.programType });
      break;
    default: // SERVICE / THERAPY
      if (service.deliveryMode) items.push({ icon: Video, text: DELIVERY_LABELS[service.deliveryMode] || service.deliveryMode });
  }
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-muted-foreground">
      {items.map((it, i) => {
        const Icon = it.icon;
        return (
          <span key={i} className="inline-flex items-center gap-1">
            <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            {it.text}
          </span>
        );
      })}
    </div>
  );
}

const PAGE_SIZE = 12;

interface ServiceListProps {
  services: Service[];
}

function ServiceCard({ service }: { service: Service }) {
  const [isFavorite, setIsFavorite] = useState(false);
  const typeMeta = listingTypeMeta((service.listingType as any) || 'SERVICE');
  const TypeIcon = typeMeta ? TYPE_ICONS[typeMeta.icon] || Stethoscope : Stethoscope;

  return (
    <Card className="hover:shadow-lg transition-all duration-200 hover:border-primary/50 relative group">
      <button
        onClick={() => setIsFavorite(!isFavorite)}
        className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 p-2 rounded-full bg-card/90 backdrop-blur-sm hover:bg-card transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        aria-pressed={isFavorite}
      >
        <Heart
          className={`h-5 w-5 ${isFavorite ? 'fill-destructive text-destructive' : 'text-muted-foreground'}`}
          aria-hidden="true"
        />
      </button>

      <CardHeader className="pb-2 sm:pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
        {/* Type + trust badges — instantly convey what and how trustworthy (plan §7.5) */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2 pr-10 sm:pr-12">
          {typeMeta && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              <TypeIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {typeMeta.singular}
            </span>
          )}
          <VerificationBadge level={service.verificationLevel} />
        </div>
        <div className="flex items-start justify-between gap-2 pr-10 sm:pr-12">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg sm:text-xl group-hover:text-primary transition-colors leading-tight line-clamp-2">
              {service.name}
            </CardTitle>
            <CardDescription className="flex items-center gap-1 mt-1.5 sm:mt-2 text-sm sm:text-base">
              <span className="truncate">{service.business.businessName}</span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6 pb-4 sm:pb-6">
        <TypeInfoLine service={service} />

        {(() => {
          // Prefer the per-listing rating (multi-listing marketplace); fall back to
          // the provider-level rating for legacy listings without their own reviews.
          const rating = service.averageRating ?? service.business.averageRating;
          const count = service.averageRating != null ? service.totalReviews : service.business.totalReviews;
          if (rating == null) return null;
          return (
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 sm:h-5 sm:w-5 fill-primary text-primary" />
              <span className="font-semibold text-sm sm:text-base">{rating.toFixed(1)}</span>
              {count != null && count > 0 && (
                <span className="text-xs sm:text-sm text-muted-foreground">
                  ({count} review{count !== 1 ? 's' : ''})
                </span>
              )}
            </div>
          );
        })()}

        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 sm:line-clamp-3 leading-relaxed">
          {service.description}
        </p>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm">
          {service.business.city && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="truncate">
                {service.business.city}, {service.business.state}
              </span>
            </div>
          )}
          {service.distance && (
            <span className="text-muted-foreground">
              {service.distance.toFixed(1)} mi away
            </span>
          )}
        </div>

        {service.serviceTypes && service.serviceTypes.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Services</h4>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {service.serviceTypes.slice(0, 2).map((type) => (
                <span
                  key={type.id}
                  className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs sm:text-sm font-medium text-primary border border-primary/20"
                >
                  {type.name}
                </span>
              ))}
              {service.serviceTypes.length > 2 && (
                <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                  +{service.serviceTypes.length - 2} more
                </span>
              )}
            </div>
          </div>
        )}

        {service.disabilities && service.disabilities.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Supports</h4>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {service.disabilities.slice(0, 2).map((disability) => (
                <span
                  key={disability.id}
                  className="inline-flex items-center rounded-md bg-accent px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs sm:text-sm font-medium text-accent-foreground border border-border"
                >
                  {disability.name}
                </span>
              ))}
              {service.disabilities.length > 2 && (
                <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                  +{service.disabilities.length - 2} more
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 sm:gap-3 pt-1 sm:pt-2">
          <Button asChild variant="default" className="flex-1 min-h-[44px] sm:min-h-[48px] text-sm sm:text-base font-semibold">
            <Link href={`/listings/${service.id}`}>View Details</Link>
          </Button>
          <ContactModal
            serviceId={service.id}
            businessId={service.business.id}
            businessUserId={service.business.userId}
            businessName={service.business.businessName}
            phone={service.business.phone || undefined}
            email={service.business.email || undefined}
            website={service.business.website || undefined}
          >
            <Button variant="outline" className="flex-1 min-h-[44px] sm:min-h-[48px] text-sm sm:text-base font-semibold">
              Contact
            </Button>
          </ContactModal>
        </div>

        <div className="flex justify-end pt-1">
          <ReportButton serviceId={service.id} />
        </div>
      </CardContent>
    </Card>
  );
}

export function ServiceList({ services }: ServiceListProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);

  const visibleServices = services.slice(0, visibleCount);
  const hasMore = visibleCount < services.length;

  const handleLoadMore = async () => {
    setLoadingMore(true);
    // Small delay to feel responsive and avoid layout flashing
    await new Promise((resolve) => setTimeout(resolve, 300));
    setVisibleCount((prev) => prev + PAGE_SIZE);
    setLoadingMore(false);
  };

  if (services.length === 0) {
    return (
      <div className="text-center py-8 sm:py-12" role="status">
        <div className="max-w-md mx-auto px-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <Search className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-3">No services found</h3>
          <p className="text-muted-foreground text-sm sm:text-base mb-4 sm:mb-6 leading-relaxed">
            We couldn't find any services matching your search. Try adjusting your filters or search terms.
          </p>
          <Button variant="outline" size="lg" onClick={() => window.location.reload()} className="min-h-[44px] sm:min-h-[48px] w-full sm:w-auto">
            Clear Filters and Start Over
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2" role="list" aria-label="Search results">
        {visibleServices.map((service) => (
          <div key={service.id} role="listitem">
            <ServiceCard service={service} />
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="flex flex-col items-center gap-2 pt-6 sm:pt-8">
          <Button
            variant="outline"
            size="lg"
            className="min-h-[44px] sm:min-h-[48px] px-6 sm:px-8 w-full sm:w-auto"
            onClick={handleLoadMore}
            disabled={loadingMore}
            aria-label={`Load more results (${services.length - visibleCount} remaining)`}
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                Loading...
              </>
            ) : (
              `Load More Results (${services.length - visibleCount} remaining)`
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Showing {visibleCount} of {services.length} results
          </p>
        </div>
      )}
    </div>
  );
}
