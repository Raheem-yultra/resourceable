'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Star, DollarSign, CheckCircle, Heart } from 'lucide-react';
import { useState } from 'react';
import { ContactModal } from './ContactModal';

interface Service {
  id: string;
  name: string;
  description: string;
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

interface ServiceListProps {
  services: Service[];
}

function ServiceCard({ service }: { service: Service }) {
  const [isFavorite, setIsFavorite] = useState(false);
  const isVerified = service.business.verificationStatus === 'APPROVED';
  
  return (
    <Card className="hover:shadow-lg transition-all duration-200 hover:border-primary/50 relative group">
      {/* Favorite Button */}
      <button
        onClick={() => setIsFavorite(!isFavorite)}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        aria-pressed={isFavorite}
      >
        <Heart
          className={`h-5 w-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
          aria-hidden="true"
        />
      </button>

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 pr-12">
          <div className="flex-1">
            <CardTitle className="text-xl group-hover:text-primary transition-colors leading-tight">
              {service.name}
            </CardTitle>
            <CardDescription className="flex items-center gap-1 mt-2 text-base">
              {service.business.businessName}
              {isVerified && (
                <span title="Verified Provider">
                  <CheckCircle className="h-5 w-5 text-green-500 ml-1" aria-label="Verified provider" />
                </span>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Price - More prominent */}
        {(service.priceMin || service.priceMax) && (
          <div className="flex items-baseline gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <span className="text-3xl font-bold text-primary" aria-label={`Starting at $${service.priceMin || 0} per session`}>
              ${service.priceMin || 0}
              {service.priceMax && service.priceMax !== service.priceMin && ` - $${service.priceMax}`}
            </span>
            <span className="text-sm text-muted-foreground">/session</span>
          </div>
        )}

        {/* Rating & Reviews */}
        {service.business.averageRating && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" aria-hidden="true" />
              <span className="font-semibold text-base" aria-label={`${service.business.averageRating.toFixed(1)} out of 5 stars`}>
                {service.business.averageRating.toFixed(1)}
              </span>
            </div>
            {service.business.totalReviews && service.business.totalReviews > 0 && (
              <span className="text-sm text-muted-foreground">
                ({service.business.totalReviews} review{service.business.totalReviews !== 1 ? 's' : ''})
              </span>
            )}
          </div>
        )}

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
          {service.description}
        </p>

        {/* Location & Distance */}
        <div className="flex items-center gap-4 text-sm">
          {service.business.city && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>
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

        {/* Service Types */}
        {service.serviceTypes && service.serviceTypes.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Services Offered</h4>
            <div className="flex flex-wrap gap-2">
              {service.serviceTypes?.slice(0, 3).map((type) => (
                <span
                  key={type.id}
                  className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1.5 text-sm font-medium text-blue-700 border border-blue-200"
                >
                  {type.name}
                </span>
              ))}
              {service.serviceTypes.length > 3 && (
                <span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-1.5 text-sm font-medium text-secondary-foreground">
                  +{service.serviceTypes.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Disability Types */}
        {service.disabilities && service.disabilities.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Conditions Supported</h4>
            <div className="flex flex-wrap gap-2">
              {service.disabilities?.slice(0, 2).map((disability) => (
                <span
                  key={disability.id}
                  className="inline-flex items-center rounded-md bg-purple-50 px-2.5 py-1.5 text-sm font-medium text-purple-700 border border-purple-200"
                >
                  {disability.name}
                </span>
              ))}
              {service.disabilities.length > 2 && (
                <span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-1.5 text-sm font-medium text-secondary-foreground">
                  +{service.disabilities.length - 2} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button asChild variant="default" className="flex-1 min-h-[48px] text-base font-semibold">
            <Link href={`/business/${service.business.id}`}>View Details</Link>
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
            <Button variant="outline" className="flex-1 min-h-[48px] text-base font-semibold">
              Contact
            </Button>
          </ContactModal>
        </div>

        {/* Why it's great badge */}
        {isVerified && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 mt-2">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <p className="text-sm text-green-800 leading-relaxed">
                <span className="font-semibold">Verified Provider:</span> This business has confirmed credentials and positive community reviews.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ServiceList({ services }: ServiceListProps) {
  if (services.length === 0) {
    return (
      <div className="text-center py-12" role="status">
        <div className="max-w-md mx-auto">
          <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6" aria-hidden="true">
            <DollarSign className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-2xl font-semibold mb-3">No services found</h3>
          <p className="text-muted-foreground text-base mb-6 leading-relaxed">
            We couldn't find any services matching your search. Try adjusting your filters or search terms to find what you're looking for.
          </p>
          <Button variant="outline" size="lg" onClick={() => window.location.reload()} className="min-h-[48px]">
            Clear Filters and Start Over
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-6 md:grid-cols-2" role="list" aria-label="Search results">
        {services.map((service) => (
          <div key={service.id} role="listitem">
            <ServiceCard service={service} />
          </div>
        ))}
      </div>

      {/* Load More / Pagination */}
      {services.length >= 12 && (
        <div className="flex justify-center pt-8">
          <Button variant="outline" size="lg" className="min-h-[48px] px-8">
            Load More Results
          </Button>
        </div>
      )}
    </div>
  );
}
