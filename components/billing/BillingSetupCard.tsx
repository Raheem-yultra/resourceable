'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';

/**
 * Prompts an approved provider to add a card and start their subscription via
 * Stripe Checkout (redirect). When `trialAvailable` is false (account already
 * used its one free trial, e.g. re-subscribing after canceling) the copy drops
 * the trial promise and reflects immediate billing.
 */
export function BillingSetupCard({ trialAvailable = true }: { trialAvailable?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const startCheckout = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start checkout');
      window.location.href = data.url; // redirect to Stripe Checkout
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/50">
      <CardHeader className="px-4 sm:px-6">
        <CreditCard className="h-6 w-6 sm:h-8 sm:w-8 text-primary mb-2" />
        <CardTitle className="text-lg sm:text-xl">
          {trialAvailable ? 'Start your 30-day free trial' : 'Reactivate your subscription'}
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          {trialAvailable ? (
            <>
              Add a payment method to activate your listing. You won&apos;t be charged until the trial ends, and you can
              cancel anytime.
            </>
          ) : (
            <>
              Add a payment method to restore your listing. Your free trial was already used, so billing resumes right
              away. You can cancel anytime.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        {error && (
          <p className="field-error mb-2" role="alert">
            {error}
          </p>
        )}
        <Button onClick={startCheckout} disabled={loading} className="w-full min-h-[44px]">
          {loading ? 'Redirecting to Stripe…' : 'Set Up Billing'}
        </Button>
      </CardContent>
    </Card>
  );
}
