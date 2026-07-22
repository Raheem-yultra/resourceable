'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  CHECK_DESCRIPTIONS,
  CHECK_LABELS,
  CHECK_ORDER,
  summarizeChecks,
  verdictLabel,
  type CheckResult,
  type CheckType,
} from '@/lib/verification/shared';
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, CircleSlash,
  HelpCircle, RefreshCw, ShieldCheck, XCircle,
} from 'lucide-react';

export interface VerificationCheckView {
  type: CheckType;
  result: CheckResult;
  summary: string;
  details?: Record<string, unknown> | null;
  checkedAt: string;
}

interface Props {
  businessId: string;
  checks: VerificationCheckView[];
  checksRunAt?: string | null;
  onUpdated: (checks: VerificationCheckView[]) => void;
}

const RESULT_STYLES: Record<CheckResult, { icon: typeof CheckCircle2; className: string; label: string }> = {
  PASS: { icon: CheckCircle2, className: 'text-emerald-600 dark:text-emerald-400', label: 'Pass' },
  WARN: { icon: AlertTriangle, className: 'text-amber-600 dark:text-amber-400', label: 'Review' },
  FAIL: { icon: XCircle, className: 'text-red-600 dark:text-red-400', label: 'Fail' },
  SKIPPED: { icon: CircleSlash, className: 'text-muted-foreground', label: 'Not provided' },
  ERROR: { icon: HelpCircle, className: 'text-muted-foreground', label: 'Unavailable' },
};

const VERDICT_STYLES: Record<string, string> = {
  CLEAR: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  REVIEW: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  BLOCKED: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  UNKNOWN: 'bg-muted text-muted-foreground border-border',
};

/** Compact always-visible pill, so the queue can be triaged without expanding rows. */
export function VerificationVerdictBadge({ checks }: { checks: VerificationCheckView[] }) {
  const summary = summarizeChecks(checks);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${VERDICT_STYLES[summary.verdict]}`}
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      {verdictLabel(summary)}
    </span>
  );
}

/** Renders a check's raw evidence so an admin can audit WHY it passed. */
function CheckDetails({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entries.length === 0) return null;
  return (
    <dl className="mt-2 grid gap-x-4 gap-y-1 rounded-md bg-muted/50 p-3 text-xs sm:grid-cols-[minmax(0,10rem)_1fr]">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="font-medium text-muted-foreground">
            {key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
          </dt>
          <dd className="break-words font-mono text-[11px] leading-relaxed">
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function VerificationSignals({ businessId, checks, checksRunAt, onUpdated }: Props) {
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const toggle = (type: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });

  const rerun = async () => {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/businesses/${businessId}/checks`, { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        onUpdated(data.checks);
      } else {
        setError(data.error || 'Could not run checks');
      }
    } catch {
      setError('Could not run checks');
    } finally {
      setRunning(false);
    }
  };

  // Stable, evidence-strength order rather than whatever the DB returned.
  const ordered = [...checks].sort((a, b) => CHECK_ORDER.indexOf(a.type) - CHECK_ORDER.indexOf(b.type));

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <Label className="text-base font-semibold">Automated checks</Label>
          <VerificationVerdictBadge checks={checks} />
        </div>
        <Button variant="outline" size="sm" onClick={rerun} disabled={running} className="min-h-[40px]">
          <RefreshCw className={`mr-2 h-4 w-4 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Checking…' : 'Re-run'}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Evidence only — these never approve or reject anyone. Each result is matched against a source the
        provider does not control (CMS NPPES, the US Census address file, DNS/RDAP, and this directory).
      </p>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No checks have been run for this provider yet. Use <span className="font-medium">Re-run</span> to check now.
        </p>
      ) : (
        <ul className="space-y-1">
          {ordered.map((check) => {
            const style = RESULT_STYLES[check.result] ?? RESULT_STYLES.ERROR;
            const Icon = style.icon;
            const isOpen = expanded.has(check.type);
            const hasDetails = check.details && Object.keys(check.details).length > 0;
            return (
              <li key={check.type} className="rounded-md">
                <button
                  type="button"
                  onClick={() => hasDetails && toggle(check.type)}
                  className={`flex w-full items-start gap-3 rounded-md px-2 py-2 text-left ${hasDetails ? 'hover:bg-muted/60' : 'cursor-default'}`}
                  aria-expanded={hasDetails ? isOpen : undefined}
                >
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.className}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium">{CHECK_LABELS[check.type] ?? check.type}</span>
                      <span className={`text-xs font-medium ${style.className}`}>{style.label}</span>
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{check.summary}</span>
                    <span className="sr-only">{CHECK_DESCRIPTIONS[check.type]}</span>
                  </span>
                  {hasDetails &&
                    (isOpen ? (
                      <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    ))}
                </button>
                {isOpen && hasDetails && <CheckDetails details={check.details as Record<string, unknown>} />}
              </li>
            );
          })}
        </ul>
      )}

      {checksRunAt && (
        <p className="text-xs text-muted-foreground">Last run {new Date(checksRunAt).toLocaleString()}</p>
      )}
    </div>
  );
}
