import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';

// Lazy initialization to avoid build-time errors when env var is not available
let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reason } = await request.json();

    if (!reason?.trim()) {
      return NextResponse.json(
        { error: 'Suspension reason is required' },
        { status: 400 }
      );
    }

    const businessId = params.id;

    // Get business details
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        user: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (business.verificationStatus !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Only approved businesses can be suspended' },
        { status: 400 }
      );
    }

    // Update business status to REJECTED (suspended)
    await prisma.business.update({
      where: { id: businessId },
      data: {
        verificationStatus: 'REJECTED',
        rejectionReason: `SUSPENDED: ${reason}`,
      },
    });

    // Send notification email
    try {
      await getResendClient().emails.send({
        from: 'ResourceAble <onboarding@resend.dev>',
        to: business.user.email,
        replyTo: 'raheemrehman22005@gmail.com',
        subject: 'Your ResourceAble Business Has Been Suspended',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                .reason-box { background: white; padding: 20px; border-left: 4px solid #f97316; margin: 20px 0; border-radius: 4px; }
                .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
                .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>⚠️ Business Suspended</h1>
                </div>
                <div class="content">
                  <p>Hello ${business.user.name || 'Business Owner'},</p>
                  
                  <p>We regret to inform you that your business profile <strong>${business.businessName}</strong> has been suspended on ResourceAble.</p>
                  
                  <div class="reason-box">
                    <h3 style="margin-top: 0; color: #f97316;">Reason for Suspension:</h3>
                    <p style="margin-bottom: 0;">${reason}</p>
                  </div>
                  
                  <p><strong>What this means:</strong></p>
                  <ul>
                    <li>Your business profile is no longer visible on the platform</li>
                    <li>All your service listings have been hidden</li>
                    <li>You cannot access your business dashboard</li>
                  </ul>
                  
                  <p>If you believe this suspension was made in error or if you have questions, please contact our support team immediately.</p>
                  
                  <p>We're here to help resolve any issues.</p>
                  
                  <div style="text-align: center;">
                    <a href="mailto:support@resourceable.com" class="button">Contact Support</a>
                  </div>
                </div>
                <div class="footer">
                  <p>ResourceAble - Connecting Special Needs with Quality Care</p>
                  <p>&copy; ${new Date().getFullYear()} ResourceAble. All rights reserved.</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send suspension email:', emailError);
      // Continue even if email fails
    }

    return NextResponse.json({ 
      message: 'Business suspended successfully',
      business: {
        id: business.id,
        businessName: business.businessName,
      },
    });
  } catch (error) {
    console.error('Error suspending business:', error);
    return NextResponse.json(
      { error: 'Failed to suspend business' },
      { status: 500 }
    );
  }
}
