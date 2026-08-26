import type { Metadata } from 'next';
import { after } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BusinessContactCard } from '@/components/business/BusinessContactCard';
import { BackLink } from '@/components/ui/back-link';
import { Breadcrumbs, type Crumb } from '@/components/ui/breadcrumbs';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbSchema, businessSchema } from '@/lib/structured-data';
import { pageMetadata, truncateDescription } from '@/lib/seo';

interface BusinessPageProps {
  params: Promise<{ id: string }>;
}

// Provider pages are shared between families as often as individual listings are,
// and inherited the same generic site-wide title until now.
export async function generateMetadata(props: BusinessPageProps): Promise<Metadata> {
  const { id } = await props.params;
  const business = await prisma.business.findUnique({
    where: { id },
    select: {
      businessName: true,
      description: true,
      city: true,
      state: true,
      isActive: true,
      verificationStatus: true,
      _count: { select: { services: true } },
    },
  });

  if (!business) return { title: 'Provider not found - ResourceAble' };

  const place = [business.city, business.state].filter(Boolean).join(', ');
  const publiclyVisible = business.isActive && business.verificationStatus === 'APPROVED';

  return pageMetadata({
    title: `${business.businessName}${place ? ` — ${place}` : ''}`,
    description: truncateDescription(
      business.description ||
        `${business.businessName}${place ? ` in ${place}` : ''} lists ${business._count.services} service${
          business._count.services === 1 ? '' : 's'
        } on ResourceAble.`
    ),
    path: `/business/${id}`,
    type: 'profile',
    noindex: !publiclyVisible,
  });
}

async function getBusinessById(id: string) {
  return await prisma.business.findUnique({
    relationLoadStrategy: 'join',
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

export default async function BusinessPage(props: BusinessPageProps) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const business = await getBusinessById(params.id);

  // Handle not found or not approved
  if (!business) {
    notFound();
  }

  // Show to non-owners only when approved and active (not suspended). The owner
  // can always view their own page, whatever its review state.
  const isOwner = business.userId === session?.user?.id;
  const publiclyVisible = business.verificationStatus === 'APPROVED' && business.isActive;
  if (!publiclyVisible && !isOwner) {
    notFound();
  }

  const canContact = session?.user && session.user.id !== business.userId;

  const trail: Crumb[] = [
    { name: 'Home', path: '/' },
    { name: 'Browse', path: '/browse' },
    { name: business.businessName, path: `/business/${business.id}` },
  ];

  // Record the visit. The provider dashboard has always displayed "Profile Views"
  // and it has always read zero, because no code path anywhere incremented the
  // column — a metric that never moves reads as "nobody is finding me" and is the
  // sort of thing that makes a provider give up on the listing.
  //
  // Owners and admins are excluded so a provider refreshing their own page cannot
  // inflate it. `after()` runs the write once the response has been sent, so
  // counting a view never costs the visitor latency and a failed counter can never
  // fail the page — and it keeps the write out of the render pass, which Next is
  // free to re-run.
  if (publiclyVisible && !isOwner && session?.user?.role !== 'ADMIN') {
    after(async () => {
      try {
        await prisma.business.update({
          where: { id: business.id },
          data: { viewCount: { increment: 1 } },
        });
      } catch (error) {
        console.error('Failed to record profile view:', error);
      }
    });
  }

  // Group disabilities by primary/secondary
  const primaryDisabilities = business.businessDisabilities.filter((bd: any) => bd.isPrimary);
  const secondaryDisabilities = business.businessDisabilities.filter((bd: any) => !bd.isPrimary);

  return (
    <div className="min-h-screen">
      {/* A suspended or pending provider is not something to advertise. */}
      {publiclyVisible && (
        <JsonLd
          data={[
            businessSchema({
              id: business.id,
              businessName: business.businessName,
              description: business.description,
              address: business.address,
              addressLine2: business.addressLine2,
              city: business.city,
              state: business.state,
              zipCode: business.zipCode,
              phone: business.phone,
              email: business.email,
              website: business.website,
              logo: business.logo,
              latitude: business.latitude,
              longitude: business.longitude,
              averageRating: business.averageRating,
              totalReviews: business.totalReviews,
            }),
            breadcrumbSchema(trail),
          ]}
        />
      )}

      {/* Header */}
      <div className="border-b">
        <div className="page-wrap flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 sm:py-4">
          <Breadcrumbs trail={trail} />
          <BackLink fallbackHref="/browse" label="Back to results" className="min-h-[44px]" />
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
                      <Link href="/business/profile">Edit Profile</Link>
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
            {/* Pass ONLY display-safe fields: this is a client component, so any
                prop is serialized into the public page payload. The full `business`
                row carries PII/internal fields (taxId, adminNotes, licenseNumber)
                that must never reach the browser. */}
            <BusinessContactCard
              business={{
                id: business.id,
                userId: business.userId,
                businessName: business.businessName,
                phone: business.phone,
                email: business.email,
                website: business.website,
                address: business.address,
                addressLine2: business.addressLine2,
                city: business.city,
                state: business.state,
                zipCode: business.zipCode,
                latitude: business.latitude,
                longitude: business.longitude,
              }}
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
