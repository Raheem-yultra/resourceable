import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { BusinessProfileForm } from '@/components/business/BusinessProfileForm';
import { prisma } from '@/lib/prisma';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Business Profile - ResourceAble',
  description: 'Update your business profile and service offerings',
};

export default async function BusinessProfilePage() {
  const session = await getServerSession(authOptions);

  // Redirect if not signed in or not a business user
  if (!session?.user || session.user.role !== 'BUSINESS') {
    redirect('/auth/signin');
  }

  // Fetch business profile
  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
    include: {
      businessDisabilities: {
        include: {
          disability: true,
        },
      },
      services: {
        include: {
          serviceTypes: {
            include: {
              serviceType: true,
            },
          },
        },
      },
    },
  });

  return (
    <div className="min-h-screen">
      <div className="page-wrap max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Business Profile</h1>
          <p className="text-muted-foreground">
            Create your comprehensive business listing. This will be the only listing for your business.
          </p>
        </div>

        <BusinessProfileForm business={business} userId={session.user.id} />
      </div>
    </div>
  );
}
