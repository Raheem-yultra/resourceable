import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AdminBusinessVerification } from '@/components/admin/BusinessVerification';
import { ApprovedBusinessesManager } from '@/components/admin/ApprovedBusinessesManager';
import { AdminMetrics } from '@/components/admin/AdminMetrics';
import { CategoryManager } from '@/components/admin/CategoryManager';
import { ReportsManager } from '@/components/admin/ReportsManager';
import { ResourcesManager } from '@/components/admin/ResourcesManager';
import { AuditLog } from '@/components/admin/AuditLog';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShieldCheck } from 'lucide-react';

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
    <div className="admin-shell">
      <div className="admin-wrap">
        <div className="mb-6 flex items-center gap-3 border-b pb-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Admin Console</h1>
            <p className="text-sm text-muted-foreground">Signed in as {session.user.name || session.user.email}</p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex w-full flex-wrap justify-start gap-1 overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="verifications">Verification Queue</TabsTrigger>
            <TabsTrigger value="businesses">Businesses</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <AdminMetrics />
          </TabsContent>

          <TabsContent value="verifications" className="space-y-4">
            <AdminBusinessVerification />
          </TabsContent>

          <TabsContent value="businesses" className="space-y-4">
            <ApprovedBusinessesManager />
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <CategoryManager />
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <ReportsManager />
          </TabsContent>

          <TabsContent value="resources" className="space-y-4">
            <ResourcesManager />
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <AuditLog />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
