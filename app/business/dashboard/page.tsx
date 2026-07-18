import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, FileText, MessageSquare, Settings, AlertTriangle } from 'lucide-react';
import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { BillingSetupCard } from '@/components/billing/BillingSetupCard';
import { ManageBillingButton } from '@/components/billing/ManageBillingButton';

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

export default async function BusinessDashboard({
  searchParams,
}: {
  searchParams: { billing?: string };
}) {
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
        verificationStatus: true,
        viewCount: true,
        subscriptionStatus: true,
        trialUsedAt: true,
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

  // Derive which billing prompt (if any) to show. Only relevant once approved.
  const isApproved = business?.verificationStatus === 'APPROVED';
  const subStatus = business?.subscriptionStatus ?? null;

  // No subscription yet → prompt to set up billing / start the trial.
  const needsBilling = isApproved && subStatus === null;
  // Live but payment failed → stays visible, but must fix card promptly.
  const isPastDue = isApproved && subStatus === 'past_due';
  // Billing lapsed → access revoked until reactivated.
  const isSuspended = isApproved && subStatus === 'suspended_billing';
  const isCanceled = isApproved && subStatus === 'canceled';
  // Healthy subscriber → offer a "Manage Billing" entry point.
  const isBillingHealthy = isApproved && (subStatus === 'active' || subStatus === 'trialing');
  // One free trial per account: a returning account (already used its trial) is billed immediately.
  const trialAvailable = !business?.trialUsedAt;

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

        {/* Billing redirect outcome (redirect can lie — real status comes from webhooks) */}
        {searchParams?.billing === 'success' && (
          <div className="mb-6 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" role="status">
            Thanks! Your payment method was submitted. Your subscription status will update within a few moments.
          </div>
        )}
        {searchParams?.billing === 'cancelled' && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200" role="status">
            Billing setup was cancelled. You can start your free trial whenever you&apos;re ready.
          </div>
        )}

        {/* Approved but not yet subscribed → prompt to set up billing */}
        {needsBilling && (
          <div className="mb-6 sm:mb-8">
            <BillingSetupCard trialAvailable={trialAvailable} />
          </div>
        )}

        {/* Past due → still live, but persistent warning to fix the card now */}
        {isPastDue && (
          <div
            className="mb-6 sm:mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4 sm:p-5 dark:border-amber-800 dark:bg-amber-950"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 dark:text-amber-100">Payment failed — action needed</h3>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                  Your last payment didn&apos;t go through. Your listing is still live for now, but please update your
                  payment method to avoid losing access.
                </p>
                <div className="mt-3">
                  <ManageBillingButton label="Update payment method" variant="default" className="min-h-[44px]" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Suspended → access revoked; reactivate via portal (subscription still exists in Stripe) */}
        {isSuspended && (
          <div
            className="mb-6 sm:mb-8 rounded-lg border border-destructive/40 bg-destructive/5 p-4 sm:p-5"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive">Your subscription is suspended</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Billing lapsed after repeated failed payments, so your listing is hidden and you can&apos;t manage
                  listings or respond to messages. Update your payment method to restore access.
                </p>
                <div className="mt-3">
                  <ManageBillingButton label="Update payment method" variant="default" className="min-h-[44px]" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Canceled → subscription is gone; start a fresh one to reactivate */}
        {isCanceled && (
          <div
            className="mb-6 sm:mb-8 rounded-lg border border-destructive/40 bg-destructive/5 p-4 sm:p-5"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive">Your subscription was canceled</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your listing is hidden and provider actions are disabled. Start a new subscription to reactivate your
                  listing.
                </p>
                <div className="mt-3">
                  <BillingSetupCard trialAvailable={trialAvailable} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Healthy subscriber → quiet entry point to the Stripe Customer Portal */}
        {isBillingHealthy && (
          <div className="mb-6 flex justify-end">
            <ManageBillingButton label="Manage Billing" />
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4 mb-6 sm:mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Services</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="text-xl sm:text-2xl font-bold">{serviceCount}</div>
              <p className="text-xs text-muted-foreground">
                {serviceCount === 0 ? 'No services listed yet' : `${serviceCount} service${serviceCount !== 1 ? 's' : ''} listed`}
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

        {/* Getting Started Section */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
          <Card className="border-primary/50">
            <CardHeader className="px-4 sm:px-6">
              <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-primary mb-2" />
              <CardTitle className="text-lg sm:text-xl">Complete Your Business Listing</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Create your comprehensive business profile with all services, specializations, and details in one place
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <Button asChild className="w-full min-h-[44px]">
                <Link href="/business/profile">Edit Profile</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-primary/50">
            <CardHeader className="px-4 sm:px-6">
              <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-primary mb-2" />
              <CardTitle className="text-lg sm:text-xl">Manage Listings</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Add and edit listings across categories — services, therapies, shop items, schools, and events. Each listing is reviewed independently.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <Button asChild variant="outline" className="w-full min-h-[44px]">
                <Link href="/business/listings">Manage Listings</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-primary/50">
            <CardHeader className="px-4 sm:px-6">
              <MessageSquare className="h-6 w-6 sm:h-8 sm:w-8 text-primary mb-2" />
              <CardTitle className="text-lg sm:text-xl">Check Messages</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Respond to customer inquiries and build relationships
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <Button asChild variant="outline" className="w-full min-h-[44px]">
                <Link href="/messages">View Messages</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Getting-started note */}
        <div className="mt-6 sm:mt-8 theme-note p-4 sm:p-6">
          <h3 className="font-semibold mb-2 text-sm sm:text-base">Getting the most out of ResourceAble</h3>
          <p className="text-xs sm:text-sm mb-3 sm:mb-4">
            Start with your business profile — it holds your contact details, location, specializations, and the
            information families see first. Then add a listing for each service, therapy, product, program, or event
            you offer.
          </p>
          {!isApproved && (
            <p className="text-xs">
              <strong>Note:</strong> Your business becomes visible to families once approved by our admin team.
              You&apos;ll get an email when that happens.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
