import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { reason } = body;

    if (!reason?.trim()) {
      return NextResponse.json(
        { error: 'Removal reason is required' },
        { status: 400 }
      );
    }

    const businessId = params.id;

    // Get business details before deletion
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        user: true,
        services: {
          select: { id: true },
        },
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Send notification email before deletion
    try {
      await resend.emails.send({
        from: 'ResourceAble <onboarding@resend.dev>',
        to: business.user.email,
        replyTo: 'raheemrehman22005@gmail.com',
        subject: 'Your ResourceAble Business Has Been Removed',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                .reason-box { background: white; padding: 20px; border-left: 4px solid #dc2626; margin: 20px 0; border-radius: 4px; }
                .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
                .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🚫 Business Removed</h1>
                </div>
                <div class="content">
                  <p>Hello ${business.user.name || 'Business Owner'},</p>
                  
                  <p>We are writing to inform you that your business profile <strong>${business.businessName}</strong> has been permanently removed from ResourceAble.</p>
                  
                  <div class="reason-box">
                    <h3 style="margin-top: 0; color: #dc2626;">Reason for Removal:</h3>
                    <p style="margin-bottom: 0;">${reason}</p>
                  </div>
                  
                  <p><strong>What has been removed:</strong></p>
                  <ul>
                    <li>Your business profile</li>
                    <li>All service listings (${business.services.length} service${business.services.length !== 1 ? 's' : ''})</li>
                    <li>Business dashboard access</li>
                  </ul>
                  
                  <p><strong>Important:</strong> This action is permanent and cannot be undone. If you wish to rejoin the platform in the future, you will need to create a new business profile and go through the verification process again.</p>
                  
                  <p>If you believe this removal was made in error or if you have questions, please contact our support team.</p>
                  
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
      console.error('Failed to send removal email:', emailError);
      // Continue even if email fails
    }

    // Delete the business and all related data (cascading deletes via Prisma schema)
    await prisma.business.delete({
      where: { id: businessId },
    });

    return NextResponse.json({ 
      message: 'Business removed successfully',
      removedBusiness: {
        id: business.id,
        businessName: business.businessName,
        servicesRemoved: business.services.length,
      },
    });
  } catch (error) {
    console.error('Error removing business:', error);
    return NextResponse.json(
      { error: 'Failed to remove business' },
      { status: 500 }
    );
  }
}
