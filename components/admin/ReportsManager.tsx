'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Flag, ExternalLink, Loader2 } from 'lucide-react';

interface ReportRow {
  id: string;
  reason: string;
  details: string | null;
  status: 'OPEN' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';
  createdAt: string;
  service: {
    id: string;
    name: string;
    listingType: string;
    business: { id: string; businessName: string } | null;
  } | null;
  reportedBy: { id: string; name: string | null; email: string } | null;
}

const REASON_LABELS: Record<string, string> = {
  inaccurate: 'Inaccurate info',
  inappropriate: 'Inappropriate content',
  scam: 'Scam / fraud',
  closed: 'Business closed',
  safety: 'Safety concern',
  other: 'Other',
};

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
  REVIEWING: 'bg-primary/10 text-primary border-primary/30',
  RESOLVED: 'bg-green-600/10 text-green-700 dark:text-green-400 border-green-600/30',
  DISMISSED: 'bg-muted text-muted-foreground border-border',
};

const FILTERS = ['ALL', 'OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'] as const;

export function ReportsManager() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('OPEN');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = filter === 'ALL' ? '' : `?status=${filter}`;
      const res = await fetch(`/api/admin/reports${qs}`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
        setOpenCount(data.openCount ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: string, status: ReportRow['status']) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Flag className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Reported listings</h2>
          {openCount > 0 && (
            <span className="rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-xs font-semibold">
              {openCount} open
            </span>
          )}
        </div>
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium border ${
                filter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading reports…
        </div>
      ) : reports.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No reports in this view.</p>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                      {r.status}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">{REASON_LABELS[r.reason] || r.reason}</span>
                    <span className="text-xs text-muted-foreground">· {new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-1.5 font-medium">
                    {r.service ? (
                      <a href={`/business/${r.service.business?.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
                        {r.service.name}
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground italic">Listing deleted</span>
                    )}
                    {r.service?.business && (
                      <span className="text-sm text-muted-foreground"> · {r.service.business.businessName}</span>
                    )}
                  </div>
                  {r.details && <p className="mt-1 text-sm text-muted-foreground">{r.details}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Reported by {r.reportedBy ? (r.reportedBy.name || r.reportedBy.email) : 'a guest'}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  {r.status !== 'REVIEWING' && r.status !== 'RESOLVED' && r.status !== 'DISMISSED' && (
                    <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => setStatus(r.id, 'REVIEWING')}>
                      Start review
                    </Button>
                  )}
                  {r.status !== 'RESOLVED' && (
                    <Button size="sm" disabled={busyId === r.id} onClick={() => setStatus(r.id, 'RESOLVED')}>
                      Resolve
                    </Button>
                  )}
                  {r.status !== 'DISMISSED' && (
                    <Button size="sm" variant="ghost" disabled={busyId === r.id} onClick={() => setStatus(r.id, 'DISMISSED')}>
                      Dismiss
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
