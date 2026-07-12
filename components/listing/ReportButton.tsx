'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

const REASONS = [
  { value: 'inaccurate', label: 'Inaccurate or outdated information' },
  { value: 'inappropriate', label: 'Inappropriate or offensive content' },
  { value: 'scam', label: 'Scam or fraudulent listing' },
  { value: 'closed', label: 'Business is closed / no longer operating' },
  { value: 'safety', label: 'Safety concern' },
  { value: 'other', label: 'Something else' },
];

/**
 * Report/flag control shown on every listing (plan §4/§7.9). Opens a small dialog
 * to submit a reason; works for guests and signed-in users alike.
 */
export function ReportButton({
  serviceId,
  variant = 'link',
}: {
  serviceId: string;
  variant?: 'link' | 'icon';
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!reason) {
      setError('Please choose a reason.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId, reason, details: details || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to submit report');
      }
      setDone(true);
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          // Reset after close so a re-open starts fresh.
          setTimeout(() => { setReason(''); setDetails(''); setDone(false); setError(''); }, 200);
        }
      }}
    >
      <DialogTrigger asChild>
        {variant === 'icon' ? (
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 min-w-[36px] min-h-[36px]"
            aria-label="Report this listing"
            title="Report this listing"
          >
            <Flag className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
          >
            <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Report
          </button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this listing</DialogTitle>
          <DialogDescription>
            Help us keep ResourceAble safe and accurate. Our team reviews every report.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <p className="py-4 text-sm text-green-700 dark:text-green-400">
            Thanks — our team will review this listing.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="report-reason">Reason *</Label>
              <select
                id="report-reason"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="">Select a reason…</option>
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-details">Details (optional)</Label>
              <Textarea
                id="report-details"
                rows={3}
                placeholder="Anything that helps us understand the issue…"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </div>
            {error && <p className="field-error" role="alert">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {done ? (
            <Button onClick={() => setOpen(false)}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
              <Button onClick={submit} disabled={loading}>{loading ? 'Submitting…' : 'Submit report'}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
