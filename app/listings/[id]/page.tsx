import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isBillingBlocked } from '@/lib/billing';
import { listingTypeMeta } from '@/lib/listing-taxonomy';
import { ReviewForm } from '@/components/listing/ReviewForm';
import { ReportButton } from '@/components/listing/ReportButton';
import { LiabilityDisclaimer } from '@/components/listing/LiabilityDisclaimer';
import { ListingContactActions } from '@/components/listing/ListingContactActions';
import { Star, MapPin, ShieldCheck, CheckCircle, ShieldQuestion, ArrowLeft, Building2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

function Stars({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex ${className}`} aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`h-4 w-4 ${value >= n - 0.5 ? 'fill-primary text-primary' : 'text-muted-foreground'}`} aria-hidden="true" />
      ))}
    </span>
  );
}

function VerificationBadge({ level }: { level: string }) {
  if (level === 'LICENSED')
    return <span className="inline-flex items-center gap-1 rounded-full bg-green-600/10 text-green-700 dark:text-green-400 border border-green-600/30 px-2 py-0.5 text-xs font-medium"><ShieldCheck className="h-3.5 w-3.5" /> Licensed</span>;
  if (level === 'BASIC_VERIFIED')
    return <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 text-xs font-medium"><CheckCircle className="h-3.5 w-3.5" /> Verified</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground border border-border px-2 py-0.5 text-xs font-medium"><ShieldQuestion className="h-3.5 w-3.5" /> Unverified</span>;
}

export default async function ListingDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  const service = await prisma.service.findUnique({
    relationLoadStrategy: 'join',
    where: { id: params.id },
    include: {
      business: { select: { id: true, businessName: true, city: true, state: true, phone: true, email: true, website: true, verificationStatus: true, subscriptionStatus: true, isActive: true, userId: true } },
      serviceTypes: { include: { serviceType: { select: { name: true, slug: true } } } },
      reviews: { where: { isPublished: true }, orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true } } } },
    },
  });

  if (!service) notFound();

  const isOwner = session?.user?.id === service.business.userId;
  const isAdmin = session?.user?.role === 'ADMIN';
  // Publicly visible only if the provider is approved, active, and billing is healthy.
  const publiclyVisible =
    service.isActive &&
    service.business.isActive &&
    service.business.verificationStatus === 'APPROVED' &&
    !isBillingBlocked(service.business.subscriptionStatus);
  if (!publiclyVisible && !isOwner && !isAdmin) notFound();

  const meta = listingTypeMeta(service.listingType);
  const myReview = session?.user?.id ? service.reviews.find((r) => r.userId === session.user.id) : undefined;
  const canReview = !!session?.user && !isOwner;

  return (
    <div className="min-h-screen">
      <div className="page-wrap max-w-3xl">
        <Link href="/browse" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to browse
        </Link>

        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {meta && <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">{meta.singular}</span>}
          <VerificationBadge level={service.verificationLevel} />
          {!publiclyVisible && <span className="rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 text-xs">Not publicly visible</span>}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold">{service.name}</h1>
        <Link href={`/business/${service.business.id}`} className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <Building2 className="h-4 w-4" /> {service.business.businessName}
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {service.averageRating != null ? (
            <span className="inline-flex items-center gap-1.5"><Stars value={service.averageRating} /> {service.averageRating.toFixed(1)} ({service.totalReviews})</span>
          ) : (
            <span>No reviews yet</span>
          )}
          {(service.business.city || service.business.state) && (
            <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {service.business.city}{service.business.state ? `, ${service.business.state}` : ''}</span>
          )}
        </div>

        {(service.priceMin != null || service.priceMax != null) && (
          <div className="mt-4 inline-flex items-baseline gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2">
            <span className="text-2xl font-bold text-primary">
              ${String(service.priceMin ?? 0)}
              {service.priceMax != null && String(service.priceMax) !== String(service.priceMin) && <span className="text-xl"> – ${String(service.priceMax)}</span>}
            </span>
          </div>
        )}

        <p className="mt-4 whitespace-pre-wrap leading-relaxed">{service.description}</p>

        {service.serviceTypes.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {service.serviceTypes.map((st) => (
              <span key={st.serviceType.slug} className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary border border-primary/20">
                {st.serviceType.name}
              </span>
            ))}
          </div>
        )}

        {/* Contact + direct message */}
        <div className="mt-6">
          <ListingContactActions
            serviceId={service.id}
            businessId={service.business.id}
            businessUserId={service.business.userId}
            businessName={service.business.businessName}
            listingName={service.name}
            phone={service.business.phone || undefined}
            email={service.business.email || undefined}
            website={service.business.website || undefined}
          />
        </div>

        <div className="mt-4">
          <ReportButton serviceId={service.id} />
        </div>

        <LiabilityDisclaimer className="mt-6" />

        {/* Reviews */}
        <section className="mt-10" aria-labelledby="reviews-heading">
          <h2 id="reviews-heading" className="text-xl font-bold mb-4">
            Reviews {service.totalReviews > 0 && <span className="text-muted-foreground font-normal">({service.totalReviews})</span>}
          </h2>

          {canReview ? (
            <div className="mb-6">
              <ReviewForm serviceId={service.id} existing={myReview ? { rating: myReview.rating, title: myReview.title, content: myReview.content } : undefined} />
            </div>
          ) : !session?.user ? (
            <p className="mb-6 text-sm text-muted-foreground">
              <Link href="/auth/signin" className="text-primary hover:underline">Sign in</Link> to leave a review.
            </p>
          ) : null}

          {service.reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews yet. Be the first to review this listing.</p>
          ) : (
            <div className="space-y-4">
              {service.reviews.map((r) => (
                <div key={r.id} className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Stars value={r.rating} />
                    <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                  {r.title && <p className="mt-1.5 font-semibold">{r.title}</p>}
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{r.content}</p>
                  <p className="mt-2 text-xs text-muted-foreground">— {r.user.name || 'Verified user'}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
