import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, FileText, MessageSquare, Settings } from 'lucide-react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Business Dashboard - ResourceAble',
  description: 'Manage your services and connect with customers on ResourceAble',
};

export default async function BusinessDashboard() {
  const session = await getServerSession(authOptions);

  // Redirect if not signed in or not a business user
  if (!session?.user || session.user.role !== 'BUSINESS') {
    redirect('/auth/signin');
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Business Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {session.user.name}! Manage your services and connect with customers.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Services</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">No services listed yet</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">No new messages</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Profile Views</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verification Status</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">Pending</div>
              <p className="text-xs text-muted-foreground">Awaiting admin approval</p>
            </CardContent>
          </Card>
        </div>

        {/* Getting Started Section */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-primary/50">
            <CardHeader>
              <Building2 className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Complete Your Business Listing</CardTitle>
              <CardDescription>
                Create your comprehensive business profile with all services, specializations, and details in one place
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/business/profile">Edit Profile</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-primary/50">
            <CardHeader>
              <MessageSquare className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Check Messages</CardTitle>
              <CardDescription>
                Respond to customer inquiries and build relationships
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/messages">View Messages</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Info Banner */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">🎉 Welcome to ResourceAble!</h3>
          <p className="text-sm text-blue-800 mb-4">
            Your account has been created successfully. Complete your comprehensive business profile to showcase all your services, specializations, and details to families in need of support.
          </p>
          <p className="text-xs text-blue-700">
            <strong>One Profile, Complete Information:</strong> Instead of creating multiple service listings, you'll have one comprehensive profile where you can add all your services, disabilities served, age groups, pricing, and availability.
          </p>
          <p className="text-xs text-blue-700 mt-2">
            Note: Your business will be visible to customers once approved by our admin team.
          </p>
        </div>
      </div>
    </div>
  );
}
