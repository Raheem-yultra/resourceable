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
import { AdminTabs } from '@/components/admin/AdminTabs';
import { TabsContent } from '@/components/ui/tabs';
import { ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Admin Dashboard - ResourceAble',
  description: 'Manage business verifications and platform content',
  // Private. robots.txt already disallows this path; the page-level directive
  // is what still holds if a URL reaches a crawler another way.
  robots: { index: false, follow: false },
};

export default async function AdminDashboard(props: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [session, searchParams] = await Promise.all([
    getServerSession(authOptions),
    props.searchParams,
  ]);

  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent('/admin')}`);
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

        {/* The open tab lives in the URL. An admin working the verification queue
            reloads constantly — after approving, after a failed action, after
            coming back from a provider's page — and every one of those used to
            dump them back on Overview to click their way in again. It also makes
            a tab linkable: "have a look at the reports queue" can be a URL. */}
        <AdminTabs initialTab={searchParams.tab}>

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
        </AdminTabs>
      </div>
    </div>
  );
}
