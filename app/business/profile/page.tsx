import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BusinessProfileForm } from '@/components/business/BusinessProfileForm';
import { BusinessSetupChecklist } from '@/components/business/BusinessSetupChecklist';
import { prisma } from '@/lib/prisma';
import { buildSetupSteps } from '@/lib/business-setup';
import { ArrowLeft } from 'lucide-react';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Business Details - ResourceAble',
  description: 'Your business identity, location, and the credentials we verify',
};

export default async function BusinessProfilePage() {
  const session = await getServerSession(authOptions);

  // Redirect if not signed in or not a business user
  if (!session?.user || session.user.role !== 'BUSINESS') {
    redirect('/auth/signin');
  }

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
    include: {
      businessDisabilities: { include: { disability: true } },
      // Only the count — listings are edited on their own page, and pulling their
      // full rows here was what made it easy to reach into "the first service".
      _count: { select: { services: true } },
    },
  });

  const steps = buildSetupSteps(business, business?._count.services ?? 0);

  return (
    <div className="min-h-screen">
      <div className="page-wrap max-w-4xl">
        <Link
          href="/business/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to dashboard
        </Link>

        <BusinessSetupChecklist steps={steps} compact activeStepId="details" />

        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold sm:text-4xl">Business details</h1>
          <p className="text-muted-foreground">
            Everything about your organisation — who you are, where you are, and the credentials we check against
            public registries. What you actually offer is set up separately, as{' '}
            <Link href="/business/listings" className="text-primary hover:underline">
              listings
            </Link>
            .
          </p>
        </div>

        <BusinessProfileForm business={business} userId={session.user.id} />
      </div>
    </div>
  );
}
