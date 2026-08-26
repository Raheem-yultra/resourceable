'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, LogIn, RefreshCw } from 'lucide-react';
import { PasswordInput } from '@/components/ui/password-input';
import { BackToSiteLink } from '@/components/auth/BackToSiteLink';
import { safeCallbackPath } from '@/lib/safe-redirect';

function SignInPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = searchParams.get('message');
  // Where the user was heading before they were asked to sign in. NextAuth adds
  // this automatically, and every in-app "sign in to do X" link now sets it too.
  // Only same-origin relative paths are honoured — an absolute URL here would let
  // a crafted link bounce someone off the site straight after authenticating.
  const callbackUrl = safeCallbackPath(searchParams.get('callbackUrl'));
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  // Set when sign-in failed specifically because the email isn't verified, so we
  // can offer the resend link instead of a dead-end "invalid credentials".
  const [needsVerification, setNeedsVerification] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  /** Append the pending destination to another auth screen's URL. */
  const withCallback = (href: string) => {
    if (!callbackUrl) return href;
    const sep = href.includes('?') ? '&' : '?';
    return `${href}${sep}callbackUrl=${encodeURIComponent(callbackUrl)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNeedsVerification(false);

    // Inline field validation before hitting the network
    const fe: { email?: string; password?: string } = {};
    if (!formData.email.trim()) fe.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) fe.email = 'Enter a valid email address';
    if (!formData.password) fe.password = 'Password is required';
    setFieldErrors(fe);
    if (Object.keys(fe).length > 0) return;

    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        // NextAuth passes the message thrown by `authorize` through as
        // result.error. lib/auth.ts only reaches the account-state checks AFTER
        // the password is verified, so echoing those two is safe — it can't be
        // used to enumerate accounts. Anything else stays deliberately vague.
        const reason = result.error;
        if (/verify your email/i.test(reason)) {
          setNeedsVerification(true);
          setError(reason);
        } else if (/deactivated/i.test(reason)) {
          setError(reason);
        } else {
          setError('Invalid email or password');
        }
        setLoading(false);
        return;
      }

      // Somewhere specific was asked for — a listing they wanted to review, the
      // inbox they clicked through to. Honour it instead of dropping everyone on
      // their role's landing page, which used to mean losing your place entirely.
      if (callbackUrl) {
        router.push(callbackUrl);
        router.refresh();
        return;
      }

      // Otherwise fall back to the natural home for the account's role.
      const response = await fetch('/api/auth/session');
      const session = await response.json();

      if (session?.user?.role === 'BUSINESS') {
        router.push('/business/dashboard');
      } else if (session?.user?.role === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push('/browse');
      }
      
      router.refresh();
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-8 sm:py-12">
      <Card className="w-full max-w-md shadow-lg bg-card/90 backdrop-blur-sm">
        <CardHeader className="space-y-3 text-center px-4 sm:px-6">
          <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <LogIn className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold">Welcome Back</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Sign in to your ResourceAble account
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {/* Success Message */}
          {message && (
            <div className="mb-6 p-4 text-sm theme-success">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
                  }}
                  className={`pl-10 ${fieldErrors.email ? 'border-destructive' : ''}`}
                  aria-invalid={!!fieldErrors.email}
                  required
                />
              </div>
              {fieldErrors.email && <p className="field-error" role="alert">{fieldErrors.email}</p>}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Link 
                  href={withCallback('/auth/forgot-password')} 
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="password"
                value={formData.password}
                autoComplete="current-password"
                invalid={!!fieldErrors.password}
                onChange={(value) => {
                  setFormData({ ...formData, password: value });
                  if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
                }}
                required
              />
              {fieldErrors.password && <p className="field-error" role="alert">{fieldErrors.password}</p>}
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 text-sm theme-danger" role="alert">
                <p>{error}</p>
                {needsVerification && (
                  <Link
                    href={`/auth/verify-email?email=${encodeURIComponent(formData.email)}`}
                    className="mt-2 inline-flex items-center gap-1.5 font-medium text-primary underline underline-offset-4 hover:no-underline"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Resend verification email
                  </Link>
                )}
              </div>
            )}

            {/* Submit Button */}
            <Button type="submit" className="w-full min-h-[48px] sm:min-h-[52px] text-base font-semibold" disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Don't have an account?
                </span>
              </div>
            </div>

            {/* Sign Up Links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button asChild variant="outline" className="min-h-[48px]">
                <Link href={withCallback('/auth/signup')}>
                  <span className="text-sm">Sign Up</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="min-h-[48px]">
                <Link href={withCallback('/auth/signup?role=BUSINESS')}>
                  <span className="text-sm">Business Signup</span>
                </Link>
              </Button>
            </div>
          </form>
          <BackToSiteLink />
        </CardContent>
      </Card>
    </div>
  );
}

// useSearchParams() needs a Suspense boundary of its own. It previously inherited
// one from the root loading.tsx, but that boundary made every route stream — which
// is what turned missing listings into soft 404s. Same pattern as the other auth
// pages.
export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <SignInPageContent />
    </Suspense>
  );
}
