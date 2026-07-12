'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Opens the Stripe Customer Portal (redirect) so a provider can update their
 * card, view invoices, or cancel. Reused for "Manage Billing" (healthy) and
 * "Update payment method" (past_due / suspended). Purely a redirect trigger —
 * all actual billing changes flow back through webhooks.
 */
export function ManageBillingButton({
  label = 'Manage Billing',
  variant = 'outline',
  className,
}: {
  label?: string;
  variant?: 'default' | 'outline';
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const openPortal = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to open billing portal');
      window.location.href = data.url; // redirect to Stripe Customer Portal
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <p className="field-error mb-2" role="alert">
          {error}
        </p>
      )}
      <Button onClick={openPortal} disabled={loading} variant={variant} className={className}>
        {loading ? 'Opening…' : label}
      </Button>
    </div>
  );
}
