import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { ListingsManager } from '@/components/business/ListingsManager';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function BusinessListingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'BUSINESS') {
    redirect('/auth/signin');
  }

  return (
    <div className="min-h-screen">
      <div className="page-wrap max-w-4xl">
        <Link href="/business/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to dashboard
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold mb-6">Manage Listings</h1>
        <ListingsManager />
      </div>
    </div>
  );
}
