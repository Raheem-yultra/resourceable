'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Building2, Clock, Ban, CheckCircle, XCircle, BarChart3, AlertTriangle, DollarSign, TrendingDown, CreditCard, Hourglass } from 'lucide-react';

interface Metrics {
  signups: { last7Days: number; last30Days: number };
  businesses: { pending: number; approvedActive: number; suspended: number; rejected: number; total: number };
  users: { total: number };
  listingsPerCategory: Array<{ id: string; name: string; category: string | null; count: number }>;
  flaggedContent: number | null;
  billing: {
    activeSubscribers: number;
    trialing: number;
    pastDue: number;
    suspendedBilling: number;
    canceled: number;
    unitAmountCents: number | null;
    currency: string | null;
    mrrCents: number | null;
    churnThisMonth: number;
  };
}

// Format minor currency units (cents) as a localized amount, e.g. 4900 → "$49".
function fmtMoney(cents: number | null, currency: string | null): string {
  if (cents == null || !currency) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'default' | 'warning' | 'danger' | 'success';
}) {
  const toneCls =
    tone === 'warning' ? 'text-amber-600' : tone === 'danger' ? 'text-destructive' : tone === 'success' ? 'text-emerald-600' : 'text-foreground';
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${toneCls}`}>{value}</div>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function AdminMetrics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/metrics');
        if (!res.ok) throw new Error('Failed to load metrics');
        setMetrics(await res.json());
      } catch (err: any) {
        setError(err.message || 'Failed to load metrics');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted/40" />
        ))}
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
        {error || 'No metrics available'}
      </div>
    );
  }

  const maxCount = Math.max(1, ...metrics.listingsPerCategory.map((c) => c.count));
  const b = metrics.billing;
  const mrrLabel = fmtMoney(b.mrrCents, b.currency);
  const priceLabel = b.unitAmountCents != null ? `${fmtMoney(b.unitAmountCents, b.currency)}/mo each` : 'Price unavailable';

  return (
    <div className="space-y-6">
      {/* Revenue / subscriptions */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <DollarSign className="h-4 w-4" /> Revenue &amp; subscriptions
        </h3>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <StatTile label="MRR (estimate)" value={mrrLabel} sub={priceLabel} icon={DollarSign} tone="success" />
          <StatTile label="Active subscribers" value={b.activeSubscribers} sub="Paying now" icon={CreditCard} tone="success" />
          <StatTile label="On trial" value={b.trialing} sub="Not yet billed" icon={Hourglass} />
          <StatTile label="Churn (this month)" value={b.churnThisMonth} sub="Subscriptions ended" icon={TrendingDown} tone={b.churnThisMonth > 0 ? 'danger' : 'default'} />
          <StatTile label="Past due" value={b.pastDue} sub="Payment failing" icon={AlertTriangle} tone={b.pastDue > 0 ? 'warning' : 'default'} />
          <StatTile label="Suspended (billing)" value={b.suspendedBilling} sub="Access revoked" icon={Ban} tone={b.suspendedBilling > 0 ? 'danger' : 'default'} />
          <StatTile label="Canceled" value={b.canceled} sub="Ended by provider" icon={XCircle} />
        </div>
        {b.mrrCents === null && (
          <p className="mt-2 text-xs text-muted-foreground">
            MRR needs Stripe configured (price lookup unavailable). Subscriber counts are still accurate.
          </p>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatTile label="New signups (7d)" value={metrics.signups.last7Days} sub={`${metrics.signups.last30Days} in last 30 days`} icon={Users} />
        <StatTile label="Pending approvals" value={metrics.businesses.pending} sub="Awaiting review" icon={Clock} tone={metrics.businesses.pending > 0 ? 'warning' : 'default'} />
        <StatTile label="Active listings" value={metrics.businesses.approvedActive} sub="Approved & visible" icon={CheckCircle} tone="success" />
        <StatTile label="Suspended" value={metrics.businesses.suspended} sub="Hidden from public" icon={Ban} tone={metrics.businesses.suspended > 0 ? 'danger' : 'default'} />
        <StatTile label="Total businesses" value={metrics.businesses.total} icon={Building2} />
        <StatTile label="Rejected" value={metrics.businesses.rejected} icon={XCircle} />
        <StatTile label="Total users" value={metrics.users.total} icon={Users} />
        <StatTile
          label="Flagged content"
          value={metrics.flaggedContent === null ? 'N/A' : metrics.flaggedContent}
          sub={metrics.flaggedContent === null ? 'No reporting system yet' : 'Open reports'}
          icon={AlertTriangle}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            Active listings per category
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.listingsPerCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No service categories defined yet.</p>
          ) : (
            <ul className="space-y-2">
              {metrics.listingsPerCategory.map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate text-sm" title={c.name}>
                    {c.name}
                    {c.category && <span className="ml-1 text-xs text-muted-foreground">({c.category})</span>}
                  </span>
                  <div className="flex-1">
                    <div
                      className="h-2 rounded-full bg-primary/70"
                      style={{ width: `${Math.max(4, (c.count / maxCount) * 100)}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
