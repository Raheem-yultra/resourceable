import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, FileText, MessageSquare, Settings } from 'lucide-react';
import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { BusinessSetupChecklist } from '@/components/business/BusinessSetupChecklist';
import { buildSetupSteps } from '@/lib/business-setup';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Business Dashboard - ResourceAble',
  description: 'Manage your services and connect with customers on ResourceAble',
};

// Presentation for each verification state (label, helper text, color)
const VERIFICATION_META: Record<string, { label: string; sub: string; cls: string }> = {
  APPROVED: { label: 'Approved', sub: 'Your listing is live', cls: 'text-green-600' },
  REJECTED: { label: 'Not Approved', sub: 'Check your email for details', cls: 'text-destructive' },
  PENDING: { label: 'Pending', sub: 'Awaiting approval', cls: 'text-yellow-600' },
};

export default async function BusinessDashboard() {
  const session = await getServerSession(authOptions);

  // Redirect if not signed in or not a business user
  if (!session?.user || session.user.role !== 'BUSINESS') {
    redirect('/auth/signin');
  }

  // Real dashboard metrics for this business (previously hardcoded to zero)
  const [business, unreadMessages] = await Promise.all([
    prisma.business.findUnique({
      where: { userId: session.user.id },
      select: {
        // The setup checklist needs every required detail field so it can say how
        // many are still missing, not just whether a business row exists.
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
        viewCount: true,
        _count: { select: { services: true } },
      },
    }),
    prisma.message.count({
      where: { receiverId: session.user.id, status: { not: 'READ' }, isArchived: false },
    }),
  ]);

  const serviceCount = business?._count.services ?? 0;
  const profileViews = business?.viewCount ?? 0;
  const verification = VERIFICATION_META[business?.verificationStatus ?? 'PENDING'];
  const setupSteps = buildSetupSteps(business, serviceCount);
  const setupComplete = setupSteps.every((s) => s.status === 'complete');

  const isApproved = business?.verificationStatus === 'APPROVED';

  return (
    <div className="min-h-screen">
      <div className="page-wrap py-4 sm:py-8">
        {/* Welcome Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold mb-2">Business Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Welcome back, {session.user.name}! Manage your services and connect with customers.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4 mb-6 sm:mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Listings</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="text-xl sm:text-2xl font-bold">{serviceCount}</div>
              <p className="text-xs text-muted-foreground">
                {serviceCount === 0 ? 'None yet' : `Across ${serviceCount === 1 ? '1 category entry' : 'your categories'}`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="text-xl sm:text-2xl font-bold">{unreadMessages}</div>
              <p className="text-xs text-muted-foreground">
                {unreadMessages === 0 ? 'No new messages' : `${unreadMessages} unread`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Profile Views</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="text-xl sm:text-2xl font-bold">{profileViews}</div>
              <p className="text-xs text-muted-foreground">Total views</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Verification</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className={`text-lg sm:text-2xl font-bold ${verification.cls}`}>{verification.label}</div>
              <p className="text-xs text-muted-foreground">{verification.sub}</p>
            </CardContent>
          </Card>
        </div>

        {/* The ordered path through setup. This replaced a pair of side-by-side
            cards that gave no sense of sequence — providers routinely opened
            "Manage Listings" first and hit an incomplete profile. */}
        <div className="mb-6 sm:mb-8">
          <BusinessSetupChecklist steps={setupSteps} />
        </div>

        {/* Day-to-day entry points, separate from setup so a live provider is not
            still reading onboarding copy months later. */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
          <Card>
            <CardHeader className="px-4 sm:px-6">
              <MessageSquare className="h-6 w-6 sm:h-8 sm:w-8 text-primary mb-2" />
              <CardTitle className="text-lg sm:text-xl">Messages</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Respond to families who have reached out about your listings.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <Button asChild variant="outline" className="w-full min-h-[44px]">
                <Link href="/messages">
                  View messages{unreadMessages > 0 ? ` (${unreadMessages})` : ''}
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-4 sm:px-6">
              <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-primary mb-2" />
              <CardTitle className="text-lg sm:text-xl">Your listings</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Add, edit, or pause any of the {serviceCount === 1 ? 'listing' : 'listings'} you offer.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <Button asChild variant="outline" className="w-full min-h-[44px]">
                <Link href="/business/listings">Manage listings</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {!isApproved && (
          <div className="mt-6 sm:mt-8 theme-note p-4 sm:p-6">
            <h3 className="font-semibold mb-2 text-sm sm:text-base">What happens after you finish setup</h3>
            <p className="text-xs sm:text-sm">
              Our team reviews your details against public registries — the NPI you gave us, your website, and your
              address. You&apos;ll get an email once you&apos;re approved, and your listings go live for families right
              away.
            </p>
          </div>
        )}

        {setupComplete && (
          <div className="mt-6 sm:mt-8 theme-note p-4 sm:p-6">
            <h3 className="font-semibold mb-2 text-sm sm:text-base">You&apos;re live</h3>
            <p className="text-xs sm:text-sm">
              Families can find your {serviceCount === 1 ? 'listing' : `${serviceCount} listings`} in search. Keeping
              ages, categories, and availability current is what keeps you showing up in the right results.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
