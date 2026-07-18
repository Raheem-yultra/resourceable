import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendContactInquiryEmail, sendCustomerConfirmationEmail } from '@/lib/email';
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit';

const contactFormSchema = z.object({
  businessId: z.string().cuid('Invalid business ID'),
  serviceId: z.string().cuid('Invalid service ID'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  email: z.string().email('Invalid email address').max(255, 'Email too long'),
  phone: z.string().max(20, 'Phone number too long').optional(),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000, 'Message too long'),
});

export async function POST(req: NextRequest) {
  try {
    // Abuse guard: this endpoint sends email to a user-supplied address, so cap
    // how often one client can fire it (best-effort — see lib/rate-limit).
    const rl = rateLimit(`contact:${clientIp(req)}`, 10, 10 * 60_000);
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const body = await req.json();
    const validation = contactFormSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid form data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { businessId, serviceId, name, email, phone, message } = validation.data;

    // Verify business and service exist
    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        businessId: businessId,
      },
      include: {
        business: {
          select: {
            businessName: true,
            email: true,
            phone: true,
            website: true,
            userId: true,
          },
        },
      },
    });

    if (!service) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    // Verify business has an email address
    if (!service.business.email) {
      return NextResponse.json(
        { error: 'Business email not available. Please contact them using the phone number or website.' },
        { status: 400 }
      );
    }

    // Send email to business notifying them of the inquiry
    try {
      await sendContactInquiryEmail({
        businessName: service.business.businessName,
        businessEmail: service.business.email,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        message: message,
        serviceName: service.name,
      });
    } catch (emailError) {
      console.error('Failed to send business notification email:', emailError);
      // Continue execution - we'll still try to send customer confirmation
    }

    // Send confirmation email to customer with business contact info
    try {
      await sendCustomerConfirmationEmail({
        customerName: name,
        customerEmail: email,
        businessName: service.business.businessName,
        businessPhone: service.business.phone || undefined,
        businessEmail: service.business.email,
        businessWebsite: service.business.website || undefined,
        serviceName: service.name,
        message: message,
      });
    } catch (emailError) {
      console.error('Failed to send customer confirmation email:', emailError);
      // Continue execution - we don't want to fail the request if email fails
      // In production, you might want to queue this for retry
    }

    return NextResponse.json({
      success: true,
      message: `We've notified ${service.business.businessName} about your inquiry! Check your email for their contact information.`,
      businessContact: {
        name: service.business.businessName,
        phone: service.business.phone,
        email: service.business.email,
        website: service.business.website,
      },
    });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'Failed to send inquiry' },
      { status: 500 }
    );
  }
}
