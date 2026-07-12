import { Resend } from 'resend';

// Lazy initialization to avoid build-time errors when env var is not available
let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

// Sender + support reply-to are env-configurable (were hardcoded to a personal Gmail before).
const FROM_EMAIL = process.env.EMAIL_FROM || 'ResourceAble <onboarding@resend.dev>';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@resourceable.com';

// HTML escape function to prevent XSS in emails
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

interface ContactInquiryEmailProps {
  businessName: string;
  businessEmail: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  message: string;
  serviceName: string;
}

interface CustomerConfirmationEmailProps {
  customerName: string;
  customerEmail: string;
  businessName: string;
  businessPhone?: string;
  businessEmail?: string;
  businessWebsite?: string;
  serviceName: string;
  message: string;
}

interface PasswordResetEmailProps {
  email: string;
  name: string;
  resetUrl: string;
}

// Send notification to business about customer inquiry
export async function sendContactInquiryEmail({
  businessName,
  businessEmail,
  customerName,
  customerEmail,
  customerPhone,
  message,
  serviceName,
}: ContactInquiryEmailProps) {
  try {
    // Sanitize all user inputs
    const safeBusiness = escapeHtml(businessName);
    const safeService = escapeHtml(serviceName);
    const safeName = escapeHtml(customerName);
    const safeEmail = escapeHtml(customerEmail);
    const safePhone = customerPhone ? escapeHtml(customerPhone) : '';
    const safeMessage = escapeHtml(message);
    
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: businessEmail,
      replyTo: SUPPORT_EMAIL,
      subject: `New Customer Inquiry - ${safeService}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #0e7490 0%, #0369a1 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
              .message-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0e7490; }
              .info-row { margin: 10px 0; padding: 10px; background: white; border-radius: 6px; }
              .label { font-weight: bold; color: #0e7490; display: inline-block; width: 120px; }
              .footer { background: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-radius: 0 0 10px 10px; }
              .cta-button { display: inline-block; background: #0e7490; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .cta-button:hover { background: #0c4a6e; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 24px;">📬 New Customer Inquiry</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">A customer has requested your contact via ResourceAble</p>
              </div>
              
              <div class="content">
                <p style="font-size: 16px; margin-top: 0;">Hello ${safeBusiness},</p>
                <p>A customer is interested in your service: <strong>${safeService}</strong></p>
                
                <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0; color: #1e40af;">
                    <strong>📌 How This Works:</strong> We've shared your contact information with the customer. 
                    If you'd like to discuss this inquiry further with our team, simply reply to this email.
                  </p>
                </div>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #0e7490;">📋 Customer Information</h3>
                  <div class="info-row">
                    <span class="label">Name:</span>
                    <span>${safeName}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">Email:</span>
                    <span><strong>${safeEmail}</strong></span>
                  </div>
                  ${customerPhone ? `
                  <div class="info-row">
                    <span class="label">Phone:</span>
                    <span><strong>${safePhone}</strong></span>
                  </div>
                  ` : ''}
                </div>

                <div class="message-box">
                  <h3 style="margin-top: 0; color: #0e7490;">💬 Customer's Message</h3>
                  <p style="white-space: pre-wrap; margin: 0;">${safeMessage}</p>
                </div>

                <div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0; color: #92400e;">
                    <strong>💡 Next Steps:</strong> Please reach out to ${safeName} directly using the contact information above. 
                    The customer can also see your contact info.
                  </p>
                </div>

                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0 0 10px 0; font-size: 14px; color: #4b5563;">
                    <strong>Need Help?</strong> If you have questions about this inquiry or need support from our team, 
                    reply to this email and we'll assist you.
                  </p>
                </div>
              </div>

              <div class="footer">
                <p style="margin: 0 0 10px 0;">This is an automated notification from ResourceAble</p>
                <p style="margin: 0; font-size: 12px;">
                  Questions? Reply to this email to contact our support team
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
New Customer Inquiry - ${serviceName}

Hello ${businessName},

A customer has requested contact via ResourceAble for your service.

HOW THIS WORKS:
We've shared your contact information with the customer. Please reach out to them directly using the information below. If you need assistance from our support team, reply to this email.

CUSTOMER INFORMATION:
- Name: ${customerName}
- Email: ${customerEmail}
${customerPhone ? `- Phone: ${customerPhone}` : ''}

CUSTOMER'S MESSAGE:
${message}

NEXT STEPS:
Please contact ${customerName} directly using the email or phone number above. They can also see your contact information on the ResourceAble platform.

---
Need help? Reply to this email to reach our support team.
This is an automated notification from ResourceAble.
      `.trim(),
    });

    if (error) {
      console.error('Resend email error:', error);
      throw new Error('Failed to send email');
    }

    return { success: true, data };
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
}

// Send confirmation to customer with business contact info
export async function sendCustomerConfirmationEmail({
  customerName,
  customerEmail,
  businessName,
  businessPhone,
  businessEmail,
  businessWebsite,
  serviceName,
  message,
}: CustomerConfirmationEmailProps) {
  try {
    // Sanitize all user inputs
    const safeName = escapeHtml(customerName);
    const safeBusiness = escapeHtml(businessName);
    const safeService = escapeHtml(serviceName);
    const safeMessage = escapeHtml(message);
    const safePhone = businessPhone ? escapeHtml(businessPhone) : '';
    const safeEmail = businessEmail ? escapeHtml(businessEmail) : '';
    const safeWebsite = businessWebsite ? escapeHtml(businessWebsite) : '';
    
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: customerEmail,
      replyTo: SUPPORT_EMAIL,
      subject: `We've contacted ${safeBusiness} on your behalf`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #0e7490 0%, #0369a1 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
              .contact-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #0e7490; }
              .info-row { margin: 10px 0; padding: 10px; background: #f9fafb; border-radius: 6px; }
              .label { font-weight: bold; color: #0e7490; display: inline-block; width: 100px; }
              .footer { background: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-radius: 0 0 10px 10px; }
              .success-badge { background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin: 10px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 24px;">✅ Your Inquiry Has Been Sent!</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">We've notified ${safeBusiness}</p>
              </div>
              
              <div class="content">
                <p style="font-size: 16px; margin-top: 0;">Hello ${safeName},</p>
                <p>Thank you for using ResourceAble! We've sent your inquiry to <strong>${safeBusiness}</strong> regarding their <strong>${safeService}</strong>.</p>
                
                <div class="contact-box">
                  <h3 style="margin-top: 0; color: #0e7490;">📞 Business Contact Information</h3>
                  <p style="margin: 0 0 15px 0; color: #6b7280;">You can reach out to them directly:</p>
                  
                  ${businessPhone ? `
                  <div class="info-row">
                    <span class="label">Phone:</span>
                    <span><a href="tel:${safePhone}" style="color: #0e7490; text-decoration: none;"><strong>${safePhone}</strong></a></span>
                  </div>
                  ` : ''}
                  
                  ${businessEmail ? `
                  <div class="info-row">
                    <span class="label">Email:</span>
                    <span><a href="mailto:${safeEmail}" style="color: #0e7490; text-decoration: none;"><strong>${safeEmail}</strong></a></span>
                  </div>
                  ` : ''}
                  
                  ${businessWebsite ? `
                  <div class="info-row">
                    <span class="label">Website:</span>
                    <span><a href="${safeWebsite.startsWith('http') ? safeWebsite : 'https://' + safeWebsite}" target="_blank" style="color: #0e7490; text-decoration: none;"><strong>${safeWebsite}</strong></a></span>
                  </div>
                  ` : ''}
                </div>

                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0e7490;">
                  <h3 style="margin-top: 0; color: #0e7490;">📝 Your Message to ${safeBusiness}</h3>
                  <p style="white-space: pre-wrap; margin: 0; color: #4b5563; font-style: italic;">"${safeMessage}"</p>
                </div>

                <div style="background: #eff6ff; border: 1px solid #3b82f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h4 style="margin-top: 0; color: #1e40af;">⏱️ What Happens Next?</h4>
                  <ul style="margin: 10px 0; padding-left: 20px; color: #1e40af;">
                    <li>${safeBusiness} will review your inquiry</li>
                    <li>They'll contact you directly using the information you provided</li>
                    <li>You can also reach out to them using the contact information above</li>
                  </ul>
                </div>

                <div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0; color: #92400e;">
                    <strong>💡 Tip:</strong> We recommend reaching out via phone for the fastest response. If you don't hear back within 24-48 hours, try contacting them directly!
                  </p>
                </div>

                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
                  <p style="margin: 0 0 10px 0; color: #4b5563;">
                    <strong>Need help or have questions?</strong>
                  </p>
                  <p style="margin: 0; font-size: 14px; color: #6b7280;">
                    Reply to this email and our support team will assist you
                  </p>
                </div>
              </div>

              <div class="footer">
                <p style="margin: 0 0 10px 0;">Thank you for using ResourceAble</p>
                <p style="margin: 0; font-size: 12px;">
                  Helping connect families with disability services
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
Your Inquiry Has Been Sent!

Hello ${customerName},

Thank you for using ResourceAble! We've sent your inquiry to ${businessName} regarding their ${serviceName}.

BUSINESS CONTACT INFORMATION:
${businessPhone ? `Phone: ${businessPhone}` : ''}
${businessEmail ? `Email: ${businessEmail}` : ''}
${businessWebsite ? `Website: ${businessWebsite}` : ''}

YOUR MESSAGE:
"${message}"

WHAT HAPPENS NEXT:
- ${businessName} will review your inquiry
- They'll contact you directly using the information you provided
- You can also reach out to them using the contact information above

TIP: We recommend reaching out via phone for the fastest response. If you don't hear back within 24-48 hours, try contacting them directly!

---
Need help? Reply to this email to reach our support team.
Thank you for using ResourceAble - Helping connect families with disability services.
      `.trim(),
    });

    if (error) {
      console.error('Resend customer confirmation error:', error);
      throw new Error('Failed to send confirmation email');
    }

    return { success: true, data };
  } catch (error) {
    console.error('Customer confirmation email failed:', error);
    throw error;
  }
}

// Send password reset email
export async function sendPasswordResetEmail({
  email,
  name,
  resetUrl,
}: PasswordResetEmailProps) {
  try {
    const safeName = escapeHtml(name);
    
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: SUPPORT_EMAIL,
      subject: 'Reset Your Password - ResourceAble',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #0e7490 0%, #0369a1 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
              .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
              .button { display: inline-block; background: #0e7490; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
              .button:hover { background: #0c4a6e; }
              .footer { background: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-radius: 0 0 10px 10px; }
              .warning { background: #fef3c7; border: 1px solid #fbbf24; padding: 15px; border-radius: 8px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 28px;">🔐 Password Reset Request</h1>
              </div>
              
              <div class="content">
                <p style="font-size: 16px; margin-top: 0;">Hello ${safeName},</p>
                
                <p>We received a request to reset your password for your ResourceAble account.</p>
                
                <p>Click the button below to reset your password. This link will expire in <strong>1 hour</strong>.</p>
                
                <div style="text-align: center;">
                  <a href="${resetUrl}" class="button">Reset My Password</a>
                </div>
                
                <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
                  Or copy and paste this link into your browser:<br>
                  <a href="${resetUrl}" style="color: #0e7490; word-break: break-all;">${resetUrl}</a>
                </p>
                
                <div class="warning">
                  <p style="margin: 0; color: #92400e;">
                    <strong>⚠️ Didn't request this?</strong><br>
                    If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                  </p>
                </div>
                
                <div style="background: #eff6ff; border: 1px solid #3b82f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h4 style="margin-top: 0; color: #1e40af;">🔒 Security Tips:</h4>
                  <ul style="margin: 10px 0; padding-left: 20px; color: #1e40af; font-size: 14px;">
                    <li>Choose a strong password (at least 8 characters)</li>
                    <li>Don't share your password with anyone</li>
                    <li>Use a unique password for ResourceAble</li>
                  </ul>
                </div>
              </div>

              <div class="footer">
                <p style="margin: 0 0 10px 0;">Thank you for using ResourceAble</p>
                <p style="margin: 0; font-size: 12px;">
                  Helping connect families with disability services
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
Password Reset Request

Hello ${safeName},

We received a request to reset your password for your ResourceAble account.

Click the link below to reset your password. This link will expire in 1 hour.

${resetUrl}

DIDN'T REQUEST THIS?
If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

SECURITY TIPS:
- Choose a strong password (at least 8 characters)
- Don't share your password with anyone
- Use a unique password for ResourceAble

---
Thank you for using ResourceAble - Helping connect families with disability services.
      `.trim(),
    });

    if (error) {
      console.error('Resend password reset error:', error);
      throw new Error('Failed to send password reset email');
    }

    return { success: true, data };
  } catch (error) {
    console.error('Password reset email failed:', error);
    throw error;
  }
}

// Email Verification
interface EmailVerificationProps {
  email: string;
  name: string;
  verificationUrl: string;
}

export async function sendVerificationEmail({
  email,
  name,
  verificationUrl,
}: EmailVerificationProps) {
  try {
    const safeName = escapeHtml(name || 'there');
    const safeEmail = escapeHtml(email);

    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Verify your email - ResourceAble',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #0e7490 0%, #0369a1 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
              .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
              .button { display: inline-block; background: #0e7490; color: white !important; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; }
              .footer { background: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-radius: 0 0 10px 10px; }
              .info-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 8px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 28px;">✉️ Verify Your Email</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Welcome to ResourceAble!</p>
              </div>
              
              <div class="content">
                <p style="font-size: 16px; margin-top: 0;">Hello ${safeName},</p>
                
                <p>Thank you for creating an account with ResourceAble! To complete your registration and start using our platform, please verify your email address.</p>
                
                <p>Click the button below to verify your email. This link will expire in <strong>24 hours</strong>.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${verificationUrl}" class="button">Verify My Email</a>
                </div>
                
                <p style="font-size: 14px; color: #6b7280;">
                  Or copy and paste this link into your browser:<br>
                  <a href="${verificationUrl}" style="color: #0e7490; word-break: break-all;">${verificationUrl}</a>
                </p>
                
                <div class="info-box">
                  <p style="margin: 0; color: #1e40af;">
                    <strong>📌 Why verify?</strong><br>
                    Email verification helps us ensure the security of your account and allows us to send you important updates about your services.
                  </p>
                </div>
                
                <div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0; color: #92400e;">
                    <strong>⚠️ Didn't create an account?</strong><br>
                    If you didn't sign up for ResourceAble, you can safely ignore this email.
                  </p>
                </div>
              </div>

              <div class="footer">
                <p style="margin: 0 0 10px 0;">Thank you for joining ResourceAble</p>
                <p style="margin: 0; font-size: 12px;">
                  Helping connect families with disability services
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
Verify Your Email - ResourceAble

Hello ${safeName},

Thank you for creating an account with ResourceAble! To complete your registration and start using our platform, please verify your email address.

Click the link below to verify your email. This link will expire in 24 hours.

${verificationUrl}

WHY VERIFY?
Email verification helps us ensure the security of your account and allows us to send you important updates about your services.

DIDN'T CREATE AN ACCOUNT?
If you didn't sign up for ResourceAble, you can safely ignore this email.

---
Thank you for joining ResourceAble - Helping connect families with disability services.
      `.trim(),
    });

    if (error) {
      console.error('Resend verification email error:', error);
      throw new Error('Failed to send verification email');
    }

    return { success: true, data };
  } catch (error) {
    console.error('Verification email failed:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Admin action notifications (suspend / unsuspend / remove).
// Centralized here so admin routes stop duplicating raw Resend calls + HTML.
// ---------------------------------------------------------------------------

interface AdminNotificationProps {
  email: string;
  name: string;
  businessName: string;
  reason?: string;
}

// Shared, minimal branded shell for admin notification emails
function adminNotificationHtml(opts: {
  accent: string;
  emoji: string;
  heading: string;
  greeting: string;
  bodyHtml: string;
  reason?: string;
}): string {
  const reasonBlock = opts.reason
    ? `<div style="background: white; padding: 20px; border-left: 4px solid ${opts.accent}; margin: 20px 0; border-radius: 4px;">
         <h3 style="margin-top: 0; color: ${opts.accent};">Reason:</h3>
         <p style="margin-bottom: 0; white-space: pre-wrap;">${escapeHtml(opts.reason)}</p>
       </div>`
    : '';
  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: ${opts.accent}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin:0;">${opts.emoji} ${escapeHtml(opts.heading)}</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <p>${escapeHtml(opts.greeting)}</p>
            ${opts.bodyHtml}
            ${reasonBlock}
            <p>If you believe this was made in error or have questions, please contact our support team.</p>
          </div>
          <div style="text-align:center; margin-top: 20px; color:#6b7280; font-size:14px;">
            <p>ResourceAble &copy; ${new Date().getFullYear()}</p>
          </div>
        </div>
      </body>
    </html>`;
}

export async function sendBusinessSuspendedEmail({ email, name, businessName, reason }: AdminNotificationProps) {
  const safeBusiness = escapeHtml(businessName);
  const { error } = await getResendClient().emails.send({
    from: FROM_EMAIL,
    to: email,
    replyTo: SUPPORT_EMAIL,
    subject: 'Your ResourceAble Business Has Been Suspended',
    html: adminNotificationHtml({
      accent: '#f97316',
      emoji: '⚠️',
      heading: 'Business Suspended',
      greeting: `Hello ${name || 'Business Owner'},`,
      bodyHtml: `<p>Your business profile <strong>${safeBusiness}</strong> has been suspended. It is no longer visible on the platform and you cannot access your dashboard while suspended.</p>`,
      reason,
    }),
  });
  if (error) {
    console.error('Resend suspension email error:', error);
    throw new Error('Failed to send suspension email');
  }
  return { success: true };
}

export async function sendBusinessUnsuspendedEmail({ email, name, businessName }: AdminNotificationProps) {
  const safeBusiness = escapeHtml(businessName);
  const { error } = await getResendClient().emails.send({
    from: FROM_EMAIL,
    to: email,
    replyTo: SUPPORT_EMAIL,
    subject: 'Your ResourceAble Business Has Been Reinstated',
    html: adminNotificationHtml({
      accent: '#0e7490',
      emoji: '✅',
      heading: 'Business Reinstated',
      greeting: `Hello ${name || 'Business Owner'},`,
      bodyHtml: `<p>Good news — your business profile <strong>${safeBusiness}</strong> has been reinstated and is visible on the platform again. You now have full access to your dashboard.</p>`,
    }),
  });
  if (error) {
    console.error('Resend reinstatement email error:', error);
    throw new Error('Failed to send reinstatement email');
  }
  return { success: true };
}

export async function sendBusinessRemovedEmail({ email, name, businessName, reason }: AdminNotificationProps) {
  const safeBusiness = escapeHtml(businessName);
  const { error } = await getResendClient().emails.send({
    from: FROM_EMAIL,
    to: email,
    replyTo: SUPPORT_EMAIL,
    subject: 'Your ResourceAble Business Has Been Removed',
    html: adminNotificationHtml({
      accent: '#dc2626',
      emoji: '🚫',
      heading: 'Business Removed',
      greeting: `Hello ${name || 'Business Owner'},`,
      bodyHtml: `<p>Your business profile <strong>${safeBusiness}</strong> and all associated service listings have been permanently removed from ResourceAble. This action cannot be undone.</p>`,
      reason,
    }),
  });
  if (error) {
    console.error('Resend removal email error:', error);
    throw new Error('Failed to send removal email');
  }
  return { success: true };
}

// ---------------------------------------------------------------------------
// Billing notifications (approval → set up billing, trial ending, payment failed).
// ---------------------------------------------------------------------------

interface BillingEmailProps {
  email: string;
  name: string;
  businessName: string;
  actionUrl: string;
  trialEndsAt?: Date | null;
}

function billingHtml(opts: {
  accent: string;
  emoji: string;
  heading: string;
  greeting: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: ${opts.accent}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin:0;">${opts.emoji} ${escapeHtml(opts.heading)}</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <p>${escapeHtml(opts.greeting)}</p>
            ${opts.bodyHtml}
            <div style="text-align:center; margin: 28px 0;">
              <a href="${opts.ctaUrl}" style="display:inline-block; background:${opts.accent}; color:#fff; padding:12px 28px; text-decoration:none; border-radius:6px; font-weight:bold;">${escapeHtml(opts.ctaLabel)}</a>
            </div>
            <p style="font-size:12px; color:#6b7280;">If the button doesn't work, copy this link:<br><a href="${opts.ctaUrl}">${opts.ctaUrl}</a></p>
          </div>
          <div style="text-align:center; margin-top: 16px; color:#6b7280; font-size:14px;">
            <p>ResourceAble &copy; ${new Date().getFullYear()}</p>
          </div>
        </div>
      </body>
    </html>`;
}

/** Sent when an admin approves a provider — prompts them to add a card and start the trial. */
export async function sendProviderApprovedBillingEmail({ email, name, businessName, actionUrl }: BillingEmailProps) {
  const safeBusiness = escapeHtml(businessName);
  const { error } = await getResendClient().emails.send({
    from: FROM_EMAIL,
    to: email,
    replyTo: SUPPORT_EMAIL,
    subject: `${businessName} is approved — start your 30-day free trial`,
    html: billingHtml({
      accent: '#0e7490',
      emoji: '🎉',
      heading: "You're Approved!",
      greeting: `Hello ${name || 'Business Owner'},`,
      bodyHtml: `<p><strong>${safeBusiness}</strong> has been approved on ResourceAble. To go live, add a payment method to start your <strong>30-day free trial</strong>. You won't be charged until the trial ends, and you can cancel anytime.</p>`,
      ctaLabel: 'Set Up Billing & Start Trial',
      ctaUrl: actionUrl,
    }),
  });
  if (error) {
    console.error('Resend approval-billing email error:', error);
    throw new Error('Failed to send approval email');
  }
  return { success: true };
}

/** Sent ~3 days before the trial ends (Stripe trial_will_end). Does not change status. */
export async function sendTrialEndingEmail({ email, name, businessName, actionUrl, trialEndsAt }: BillingEmailProps) {
  const safeBusiness = escapeHtml(businessName);
  const when = trialEndsAt ? escapeHtml(trialEndsAt.toLocaleDateString()) : 'soon';
  const { error } = await getResendClient().emails.send({
    from: FROM_EMAIL,
    to: email,
    replyTo: SUPPORT_EMAIL,
    subject: 'Your ResourceAble free trial is ending soon',
    html: billingHtml({
      accent: '#f97316',
      emoji: '⏳',
      heading: 'Trial Ending Soon',
      greeting: `Hello ${name || 'Business Owner'},`,
      bodyHtml: `<p>Your free trial for <strong>${safeBusiness}</strong> ends on <strong>${when}</strong>. Your subscription will begin automatically using the card on file — no action needed to keep your listing live. To review or update your payment method, use the button below.</p>`,
      ctaLabel: 'Manage Billing',
      ctaUrl: actionUrl,
    }),
  });
  if (error) {
    console.error('Resend trial-ending email error:', error);
    throw new Error('Failed to send trial-ending email');
  }
  return { success: true };
}

/** Sent on invoice.payment_failed — provider goes past_due and needs to fix their card. */
export async function sendPaymentFailedEmail({ email, name, businessName, actionUrl }: BillingEmailProps) {
  const safeBusiness = escapeHtml(businessName);
  const { error } = await getResendClient().emails.send({
    from: FROM_EMAIL,
    to: email,
    replyTo: SUPPORT_EMAIL,
    subject: 'Action needed: payment failed for your ResourceAble subscription',
    html: billingHtml({
      accent: '#dc2626',
      emoji: '⚠️',
      heading: 'Payment Failed',
      greeting: `Hello ${name || 'Business Owner'},`,
      bodyHtml: `<p>We couldn't process the payment for <strong>${safeBusiness}</strong>. Your listing is still visible for now, but please update your payment method to avoid interruption. We'll retry automatically, and if all retries fail your listing will be suspended.</p>`,
      ctaLabel: 'Update Payment Method',
      ctaUrl: actionUrl,
    }),
  });
  if (error) {
    console.error('Resend payment-failed email error:', error);
    throw new Error('Failed to send payment-failed email');
  }
  return { success: true };
}
