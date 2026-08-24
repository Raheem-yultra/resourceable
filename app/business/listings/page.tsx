import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ListingsManager } from '@/components/business/ListingsManager';
import { BusinessSetupChecklist } from '@/components/business/BusinessSetupChecklist';
import { buildSetupSteps, missingDetailFields } from '@/lib/business-setup';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Info } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function BusinessListingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'BUSINESS') {
    redirect('/auth/signin');
  }

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
    select: {
      businessName: true,
      description: true,
      phone: true,
      email: true,
      address: true,
      city: true,
      state: true,
      zipCode: true,
      npi: true,
      website: true,
      licenseNumber: true,
      yearEstablished: true,
      verificationStatus: true,
      _count: { select: { services: true } },
    },
  });

  const listingCount = business?._count.services ?? 0;
  const steps = buildSetupSteps(business, listingCount);
  const missingDetails = missingDetailFields(business);

  return (
    <div className="min-h-screen">
      <div className="page-wrap max-w-4xl">
        <Link
          href="/business/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to dashboard
        </Link>

        <BusinessSetupChecklist steps={steps} compact activeStepId="listings" />

        <div className="mb-6">
          <h1 className="mb-2 text-2xl font-bold sm:text-3xl">Your listings</h1>
          <p className="text-muted-foreground">
            Each listing is one thing you offer, with its own page, reviews, and place in search. Add as many as you
            like across services, therapies, shop items, schools, and events.
          </p>
        </div>

        {/* Listings can be drafted before the profile is finished, but nothing goes
            live until it is — say so here rather than letting the provider find out
            from the admin queue. */}
        {missingDetails.length > 0 && (
          <div className="theme-note mb-6 flex flex-wrap items-center gap-3 p-4">
            <Info className="h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="flex-1 text-sm">
              Your business details are still missing {missingDetails.length} required field
              {missingDetails.length === 1 ? '' : 's'}. You can build listings now, but we cannot review your
              application until those are filled in.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/business/profile">Finish details</Link>
            </Button>
          </div>
        )}

        <ListingsManager />
      </div>
    </div>
  );
}
