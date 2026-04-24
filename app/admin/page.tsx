import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AdminBusinessVerification } from '@/components/admin/BusinessVerification';
import { ApprovedBusinessesManager } from '@/components/admin/ApprovedBusinessesManager';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const metadata: Metadata = {
  title: 'Admin Dashboard - ResourceAble',
  description: 'Manage business verifications and platform content',
};

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  return (
    <div className="min-h-screen">
      <div className="page-wrap">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage business verifications and platform content
          </p>
        </div>

        <Tabs defaultValue="verifications" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="verifications">Pending Verifications</TabsTrigger>
            <TabsTrigger value="approved">Approved Businesses</TabsTrigger>
          </TabsList>

          <TabsContent value="verifications" className="space-y-4">
            <AdminBusinessVerification />
          </TabsContent>

          <TabsContent value="approved" className="space-y-4">
            <ApprovedBusinessesManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
