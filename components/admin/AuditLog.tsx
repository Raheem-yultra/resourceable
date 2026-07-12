'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollText } from 'lucide-react';

interface AdminActionRow {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string | null;
  reason: string | null;
  createdAt: string;
  admin: { id: string; name: string | null; email: string };
}

const ACTION_META: Record<string, { label: string; cls: string }> = {
  BUSINESS_APPROVED: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  BUSINESS_REJECTED: { label: 'Rejected', cls: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' },
  BUSINESS_SUSPENDED: { label: 'Suspended', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  BUSINESS_UNSUSPENDED: { label: 'Reinstated', cls: 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300' },
  BUSINESS_REMOVED: { label: 'Removed', cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
  CATEGORY_CREATED: { label: 'Category created', cls: 'bg-muted text-foreground' },
  CATEGORY_UPDATED: { label: 'Category edited', cls: 'bg-muted text-foreground' },
  CATEGORY_ARCHIVED: { label: 'Category archived', cls: 'bg-muted text-muted-foreground' },
  CATEGORY_RESTORED: { label: 'Category restored', cls: 'bg-muted text-foreground' },
};

const ACTION_FILTERS = [
  { value: '', label: 'All actions' },
  { value: 'BUSINESS_APPROVED', label: 'Approvals' },
  { value: 'BUSINESS_REJECTED', label: 'Rejections' },
  { value: 'BUSINESS_SUSPENDED', label: 'Suspensions' },
  { value: 'BUSINESS_UNSUSPENDED', label: 'Reinstatements' },
  { value: 'BUSINESS_REMOVED', label: 'Removals' },
];

export function AuditLog() {
  const [rows, setRows] = useState<AdminActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (action) params.set('action', action);
      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load audit log');
      const data = await res.json();
      setRows(data.actions || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [action, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScrollText className="h-4 w-4" />
          Admin Audit Log
        </CardTitle>
        <p className="text-sm text-muted-foreground">Every admin action is recorded here — who did what, to which record, and why.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {ACTION_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={action === f.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setAction(f.value);
                setPage(1);
              }}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted/40" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No admin actions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Action</th>
                  <th className="py-2 pr-3 font-medium">Target</th>
                  <th className="py-2 pr-3 font-medium">Admin</th>
                  <th className="py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const meta = ACTION_META[r.action] || { label: r.action, cls: 'bg-muted text-foreground' };
                  return (
                    <tr key={r.id} className="border-b align-top last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>
                      </td>
                      <td className="py-2 pr-3">
                        <span className="font-medium">{r.targetLabel || r.targetId}</span>
                        <span className="ml-1 text-xs text-muted-foreground">({r.targetType})</span>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{r.admin.name || r.admin.email}</td>
                      <td className="py-2 max-w-xs text-muted-foreground">{r.reason || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
