import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit';
import { getAppBaseUrl } from '@/lib/env';

export async function GET(req: NextRequest) {
  try {
    // Unauthenticated lookup keyed on a caller-supplied secret. The token is 32
    // random bytes so guessing it is not realistic, but throttling keeps the
    // attempt from costing a database query each time.
    const rl = rateLimit(`verify-check:${clientIp(req)}`, 30, 15 * 60_000);
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Find user with this verification token
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpiry: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }

    // Update user as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
    });

    return NextResponse.json(
      { message: 'Email verified successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify email. Please try again.' },
      { status: 500 }
    );
  }
}

// Resend verification email
export async function POST(req: NextRequest) {
  try {
    // Unauthenticated and sends mail to a caller-supplied address, so it's the
    // same mail-bomb vector as signup/forgot-password and gets the same throttle.
    const rl = rateLimit(`verify-resend:${clientIp(req)}`, 5, 15 * 60_000);
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // One response for every outcome below. Saying "already verified" here would
    // confirm both that the address has an account AND what state it is in, which
    // is exactly what the unknown-address branch is written to avoid.
    const GENERIC_RESPONSE = NextResponse.json(
      { message: 'If an account exists and still needs verifying, a verification email will be sent.' },
      { status: 200 }
    );

    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase() },
    });

    if (!user || user.emailVerified) {
      return GENERIC_RESPONSE;
    }

    // Generate new verification token
    const crypto = await import('crypto');
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpiry: verificationExpiry,
      },
    });

    // Send verification email
    const { sendVerificationEmail } = await import('@/lib/email');
    const verificationUrl = `${getAppBaseUrl()}/auth/verify-email?token=${verificationToken}`;

    // Non-fatal, for two reasons: the token is already persisted so the user can
    // retry, and a 500 that only ever appears for real unverified accounts would
    // leak exactly what the generic response above exists to hide.
    try {
      await sendVerificationEmail({
        email: user.email,
        name: user.name || 'User',
        verificationUrl,
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }

    return GENERIC_RESPONSE;
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { error: 'Failed to resend verification email. Please try again.' },
      { status: 500 }
    );
  }
}
