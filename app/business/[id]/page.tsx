import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BusinessContactCard } from '@/components/business/BusinessContactCard';

interface BusinessPageProps {
  params: { id: string };
}

async function getBusinessById(id: string) {
  return await prisma.business.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      services: {
        where: { isActive: true },
        include: {
          serviceDisabilities: {
            include: {
              disability: true,
            },
          },
          serviceTypes: {
            include: {
              serviceType: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      businessDisabilities: {
        include: {
          disability: true,
        },
        orderBy: {
          isPrimary: 'desc',
        },
      },
      reviews: {
        where: { isPublished: true },
        take: 5,
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });
}

export default async function BusinessPage({ params }: BusinessPageProps) {
  const session = await getServerSession(authOptions);
  const business = await getBusinessById(params.id);

  // Handle not found or not approved
  if (!business) {
    notFound();
  }

  // Only show approved businesses to non-owners
  if (business.verificationStatus !== 'APPROVED' && business.userId !== session?.user?.id) {
    notFound();
  }

  const canContact = session?.user && session.user.id !== business.userId;
  const isOwner = session?.user?.id === business.userId;

  // Group disabilities by primary/secondary
  const primaryDisabilities = business.businessDisabilities.filter((bd: any) => bd.isPrimary);
  const secondaryDisabilities = business.businessDisabilities.filter((bd: any) => !bd.isPrimary);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b">
        <div className="page-wrap py-3 sm:py-4">
          <Link href="/search" className="text-primary hover:underline text-sm sm:text-base inline-flex items-center min-h-[44px]">
            ← Back to Search
          </Link>
        </div>
      </div>

      <div className="page-wrap py-4 sm:py-8">
        <div className="grid lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Business Header */}
            <Card>
              <CardHeader className="px-4 sm:px-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {business.logo && (
                        <img
                          src={business.logo}
                          alt={business.businessName}
                          className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <CardTitle className="text-xl sm:text-3xl mb-1 break-words">
                          {business.businessName}
                        </CardTitle>
                        {business.businessType && (
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {business.businessType}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-3">
                      {business.verificationStatus === 'APPROVED' && (
                        <span className="theme-pill">
                          ✓ Verified
                        </span>
                      )}
                      
                      {business.averageRating && (
                        <div className="flex items-center gap-1 text-sm">
                          <span className="text-yellow-500">★</span>
                          <span className="font-semibold">{business.averageRating.toFixed(1)}</span>
                          <span className="text-xs sm:text-sm text-muted-foreground">
                            ({business.totalReviews})
                          </span>
                        </div>
                      )}

                      {business.yearEstablished && (
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          Est. {business.yearEstablished}
                        </span>
                      )}
                    </div>
                  </div>

                  {isOwner && (
                    <Button asChild variant="outline" className="w-full sm:w-auto min-h-[44px]">
                      <Link href="/dashboard/business/edit">Edit Profile</Link>
                    </Button>
                  )}
                </div>
              </CardHeader>

              {business.description && (
                <CardContent className="px-4 sm:px-6">
                  <h3 className="font-semibold mb-2 text-sm sm:text-base">About</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap text-sm sm:text-base">
                    {business.description}
                  </p>
                </CardContent>
              )}
            </Card>

            {/* Disabilities Served */}
            {business.businessDisabilities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Disabilities & Conditions Served</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {primaryDisabilities.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Primary Specialties</h4>
                      <div className="flex flex-wrap gap-2">
                        {primaryDisabilities.map((bd: any) => (
                          <span
                            key={bd.id}
                            className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
                          >
                            {bd.disability.name}
                            {bd.experience && (
                              <span className="ml-1 text-xs text-primary/70">
                                ({bd.experience}+ yrs)
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {secondaryDisabilities.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Also Serves</h4>
                      <div className="flex flex-wrap gap-2">
                        {secondaryDisabilities.map((bd: any) => (
                          <span
                            key={bd.id}
                            className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground"
                          >
                            {bd.disability.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Services Offered */}
            {business.services.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Services Offered</CardTitle>
                  <CardDescription>
                    {business.services.length} {business.services.length === 1 ? 'service' : 'services'} available
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {business.services.map((service: any) => (
                    <div key={service.id} className="border-b last:border-0 pb-6 last:pb-0">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-lg">{service.name}</h3>
                        {service.priceRange !== 'CONTACT' && (
                          <span className="text-sm font-medium text-primary">
                            {formatPriceRange(service.priceRange)}
                          </span>
                        )}
                      </div>

                      {service.shortDescription && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {service.shortDescription}
                        </p>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mb-3 text-xs sm:text-sm">
                        {service.duration && (
                          <div>
                            <span className="font-medium">Duration:</span> {service.duration}
                          </div>
                        )}
                        {service.frequency && (
                          <div>
                            <span className="font-medium">Frequency:</span> {service.frequency}
                          </div>
                        )}
                        {service.ageGroups.length > 0 && (
                          <div>
                            <span className="font-medium">Ages:</span>{' '}
                            {service.ageGroups.map(formatAgeGroup).join(', ')}
                          </div>
                        )}
                        {service.insuranceAccepted && (
                          <div>
                            <span className="text-primary">✓ Insurance Accepted</span>
                          </div>
                        )}
                      </div>

                      {/* Service Types */}
                      {service.serviceTypes.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {service.serviceTypes.map((st: any) => (
                            <span
                              key={st.id}
                               className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                            >
                              {st.serviceType.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Related Disabilities */}
                      {service.serviceDisabilities.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {service.serviceDisabilities.slice(0, 5).map((sd: any) => (
                            <span
                              key={sd.id}
                               className="inline-flex items-center rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground"
                            >
                              {sd.disability.name}
                            </span>
                          ))}
                          {service.serviceDisabilities.length > 5 && (
                            <span className="text-xs text-muted-foreground self-center">
                              +{service.serviceDisabilities.length - 5} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Reviews */}
            {business.reviews.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Reviews</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {business.reviews.map((review: any) => (
                    <div key={review.id} className="border-b last:border-0 pb-4 last:pb-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{review.user.name || 'Anonymous'}</span>
                        <div className="flex items-center">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span
                              key={i}
                               className={i < review.rating ? 'text-primary' : 'text-muted-foreground/40'}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                      </div>
                      {review.title && (
                        <h4 className="font-semibold text-sm mb-1">{review.title}</h4>
                      )}
                      <p className="text-sm text-muted-foreground">{review.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact & Location */}
            <BusinessContactCard
              business={business}
              session={session}
              canContact={!!canContact}
              firstServiceId={business.services[0]?.id}
            />

            {/* Hours of Operation */}
            {business.hoursOfOperation && (
              <Card>
                <CardHeader>
                  <CardTitle>Hours of Operation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {Object.entries(business.hoursOfOperation as any).map(([day, hours]) => (
                      <div key={day} className="flex justify-between">
                        <span className="font-medium capitalize">{day}</span>
                        <span className="text-muted-foreground">{hours as string}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Additional Info */}
            <Card>
              <CardHeader>
                <CardTitle>Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {business.licenseNumber && (
                  <div>
                    <span className="font-medium">License #:</span>{' '}
                    <span className="text-muted-foreground">{business.licenseNumber}</span>
                  </div>
                )}
                {business.yearEstablished && (
                  <div>
                    <span className="font-medium">Established:</span>{' '}
                    <span className="text-muted-foreground">{business.yearEstablished}</span>
                  </div>
                )}
                <div>
                  <span className="font-medium">Last Updated:</span>{' '}
                  <span className="text-muted-foreground">
                    {new Date(business.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function formatPriceRange(range: string): string {
  const ranges: Record<string, string> = {
    FREE: 'Free',
    LOW: '$0 - $50',
    MEDIUM: '$50 - $150',
    HIGH: '$150 - $300',
    PREMIUM: '$300+',
    CONTACT: 'Contact for pricing',
  };
  return ranges[range] || range;
}

function formatAgeGroup(group: string): string {
  const groups: Record<string, string> = {
    INFANT: 'Infant (0-2)',
    TODDLER: 'Toddler (2-5)',
    CHILD: 'Child (5-12)',
    TEEN: 'Teen (12-18)',
    ADULT: 'Adult (18+)',
    ALL_AGES: 'All Ages',
  };
  return groups[group] || group;
}
