'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

const errorMessages: Record<string, string> = {
  Configuration: 'There is a problem with the server configuration. Please try again later.',
  AccessDenied: 'You do not have permission to sign in.',
  Verification: 'The verification link may have expired or already been used.',
  OAuthSignin: 'Error occurred while trying to sign in.',
  OAuthCallback: 'Error occurred while handling the sign in response.',
  OAuthCreateAccount: 'Could not create user account.',
  EmailCreateAccount: 'Could not create user account.',
  Callback: 'Error occurred during the callback.',
  OAuthAccountNotLinked: 'This email is already associated with another account.',
  EmailSignin: 'The email could not be sent.',
  CredentialsSignin: 'Sign in failed. Check the details you provided are correct.',
  SessionRequired: 'Please sign in to access this page.',
  Default: 'An error occurred during authentication.',
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  
  const errorMessage = error && errorMessages[error] 
    ? errorMessages[error] 
    : errorMessages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/30 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-8 w-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-foreground">
            Authentication Error
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {errorMessage}
          </p>
          {error && (
            <p className="mt-1 text-xs text-muted-foreground/80">
              Error code: {error}
            </p>
          )}
        </div>

        <div className="mt-8 space-y-4">
          <Link
            href="/auth/signin"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Try signing in again
          </Link>
          <Link
            href="/"
            className="w-full flex justify-center py-3 px-4 border border-border rounded-md shadow-sm text-sm font-medium text-foreground bg-card hover:bg-secondary/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Go to homepage
          </Link>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Need help?{' '}
            <Link href="/contact" className="text-primary hover:text-primary/80">
              Contact support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/30">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  );
}
