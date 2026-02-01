'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-lg p-6 sm:p-8">
        <div className="text-center">
          <div className="text-5xl sm:text-6xl mb-4">⚠️</div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
            Something went wrong!
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base mb-6">
            We apologize for the inconvenience. An unexpected error has occurred.
          </p>
          <div className="space-y-3">
            <Button
              onClick={reset}
              className="w-full min-h-[48px]"
            >
              Try again
            </Button>
            <Button
              onClick={() => window.location.href = '/'}
              variant="outline"
              className="w-full min-h-[48px]"
            >
              Go to homepage
            </Button>
          </div>
          {process.env.NODE_ENV === 'development' && error.message && (
            <details className="mt-6 text-left">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground min-h-[44px] flex items-center">
                Error details (dev only)
              </summary>
              <pre className="mt-2 text-xs bg-muted p-3 rounded-lg overflow-auto max-h-40">
                {error.message}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
