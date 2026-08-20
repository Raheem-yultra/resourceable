import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '@/lib/email';
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit';
import { getAppBaseUrl } from '@/lib/env';

export async function POST(req: NextRequest) {
  try {
    // Throttle so this can't be used to bomb a victim with reset emails.
    const rl = rateLimit(`forgot:${clientIp(req)}`, 5, 15 * 60_000);
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const { email } = await req.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration attacks
    // Don't reveal if email exists or not
    if (!user) {
      return NextResponse.json({
        message: 'If an account exists with this email, you will receive a password reset link.',
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Save token to database
    await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // Send email with reset link
    const resetUrl = `${getAppBaseUrl()}/auth/reset-password?token=${resetToken}`;
    
    // A provider outage must not 500 here: the token is already persisted, and a
    // failure that surfaces only for real accounts would leak which emails exist.
    // Log it and return the same generic message either way — the user can retry.
    try {
      await sendPasswordResetEmail({
        email: user.email,
        name: user.name || 'User',
        resetUrl,
      });
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
    }

    return NextResponse.json({
      message: 'If an account exists with this email, you will receive a password reset link.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
