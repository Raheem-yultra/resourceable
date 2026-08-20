import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit';
import { sendPasswordChangedEmail } from '@/lib/email';
import { getAppBaseUrl } from '@/lib/env';

export async function POST(req: NextRequest) {
  try {
    // Throttle to blunt brute-forcing of reset tokens.
    const rl = rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60_000);
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Find user with valid token
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date(), // Token must not be expired
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    // Security notice — this is how a user learns about a takeover they didn't
    // initiate. Non-fatal: the password is already changed, so a mail outage must
    // not make the reset look like it failed and send them round again.
    try {
      await sendPasswordChangedEmail({
        email: user.email,
        name: user.name || 'User',
        changedAt: new Date(),
        resetUrl: `${getAppBaseUrl()}/auth/forgot-password`,
      });
    } catch (emailError) {
      console.error('Failed to send password changed email:', emailError);
    }

    return NextResponse.json({
      message: 'Password reset successful. You can now sign in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
