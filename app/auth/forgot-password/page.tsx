'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-8 sm:p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center px-4 sm:px-6">
            <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl sm:text-3xl">✅</span>
            </div>
            <CardTitle className="text-xl sm:text-2xl">Check Your Email</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              We've sent password reset instructions to <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-4 sm:px-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <p className="text-sm text-blue-800">
                <strong>📬 Next Steps:</strong>
              </p>
              <ul className="text-xs sm:text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                <li>Check your email inbox (and spam folder)</li>
                <li>Click the reset link in the email</li>
                <li>The link expires in 1 hour</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Button asChild variant="outline" className="w-full min-h-[48px]">
                <Link href="/auth/signin">← Back to Sign In</Link>
              </Button>
              <Button 
                variant="ghost" 
                className="w-full min-h-[44px]"
                onClick={() => {
                  setSuccess(false);
                  setEmail('');
                }}
              >
                Try a different email
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-8 sm:p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center px-4 sm:px-6">
          <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl sm:text-3xl">🔐</span>
          </div>
          <CardTitle className="text-xl sm:text-2xl">Forgot Password?</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            No worries! Enter your email and we'll send you reset instructions.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full min-h-[44px]"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full min-h-[48px] text-base font-semibold" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Sending...
                </>
              ) : (
                'Send Reset Link'
              )}
            </Button>

            <div className="text-center space-y-3 pt-2">
              <Link 
                href="/auth/signin" 
                className="text-sm text-primary hover:underline block min-h-[44px] flex items-center justify-center"
              >
                ← Back to Sign In
              </Link>
              <p className="text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Link href="/auth/signup" className="text-primary hover:underline font-medium">
                  Sign up
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
