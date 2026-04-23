'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CheckCircle, XCircle, Loader2, Mail, RefreshCw } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'pending'>('pending');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    if (token) {
      verifyEmail(token);
    }
  }, [token]);

  const verifyEmail = async (verificationToken: string) => {
    setStatus('loading');
    try {
      const response = await fetch(`/api/auth/verify-email?token=${verificationToken}`);
      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(data.message);
        // Redirect to signin after 3 seconds
        setTimeout(() => {
          router.push('/auth/signin?message=Email verified successfully. You can now sign in.');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(data.error || 'Verification failed');
      }
    } catch (error) {
      setStatus('error');
      setMessage('An error occurred during verification');
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setResending(true);
    setResendMessage('');

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (response.ok) {
        setResendMessage('Verification email sent! Please check your inbox.');
      } else {
        setResendMessage(data.error || 'Failed to resend email');
      }
    } catch (error) {
      setResendMessage('An error occurred. Please try again.');
    } finally {
      setResending(false);
    }
  };

  // If we have a token, show verification status
  if (token) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center px-4 py-6">
        <Card className="w-full max-w-md shadow-lg bg-card/90 backdrop-blur-sm">
          <CardHeader className="space-y-3 text-center">
            {status === 'loading' && (
              <>
                <div className="mx-auto w-16 h-16 bg-primary/15 rounded-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <CardTitle className="text-2xl font-bold">Verifying Email...</CardTitle>
                <CardDescription>Please wait while we verify your email address.</CardDescription>
              </>
            )}
            
            {status === 'success' && (
              <>
                <div className="mx-auto w-16 h-16 bg-primary/15 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold">Email Verified!</CardTitle>
                <CardDescription>{message}</CardDescription>
              </>
            )}
            
            {status === 'error' && (
              <>
                <div className="mx-auto w-16 h-16 bg-destructive/15 rounded-full flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-destructive" />
                </div>
                <CardTitle className="text-2xl font-bold">Verification Failed</CardTitle>
                <CardDescription>{message}</CardDescription>
              </>
            )}
          </CardHeader>
          
          <CardContent className="space-y-4">
            {status === 'success' && (
              <p className="text-center text-sm text-muted-foreground">
                Redirecting you to sign in...
              </p>
            )}
            
            {status === 'error' && (
              <div className="space-y-4">
                <p className="text-center text-sm text-muted-foreground">
                  The verification link may have expired or is invalid.
                </p>
                <form onSubmit={handleResend} className="space-y-3">
                  <Input
                    type="email"
                    placeholder="Enter your email to resend"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="min-h-[44px]"
                  />
                  <Button type="submit" className="w-full min-h-[44px]" disabled={resending}>
                    {resending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Resend Verification Email
                      </>
                    )}
                  </Button>
                </form>
                {resendMessage && (
                  <p className={`text-center text-sm ${resendMessage.includes('sent') ? 'text-primary' : 'text-destructive'}`}>
                    {resendMessage}
                  </p>
                )}
              </div>
            )}
            
            <Button asChild variant="outline" className="w-full min-h-[44px]">
              <Link href="/auth/signin">Go to Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No token - show instructions to check email
  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-6">
      <Card className="w-full max-w-md shadow-lg bg-card/90 backdrop-blur-sm">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
          <CardDescription>
            We&apos;ve sent a verification link to your email address. Please click the link to verify your account.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
            <p><strong>Didn&apos;t receive the email?</strong></p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Check your spam or junk folder</li>
              <li>Make sure you entered the correct email</li>
              <li>Wait a few minutes and try again</li>
            </ul>
          </div>
          
          <div className="space-y-3">
            <p className="text-sm text-center text-muted-foreground">
              Need to resend the verification email?
            </p>
            <form onSubmit={handleResend} className="space-y-3">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-[44px]"
              />
              <Button type="submit" variant="outline" className="w-full min-h-[44px]" disabled={resending}>
                {resending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Resend Verification Email
                  </>
                )}
              </Button>
            </form>
            {resendMessage && (
              <p className={`text-center text-sm ${resendMessage.includes('sent') ? 'text-primary' : 'text-destructive'}`}>
                {resendMessage}
              </p>
            )}
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Already verified?
              </span>
            </div>
          </div>
          
          <Button asChild className="w-full min-h-[44px]">
            <Link href="/auth/signin">Sign In</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
