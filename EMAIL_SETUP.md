# Email Setup Guide

## Overview
The contact form now sends emails to businesses using **Resend** - a modern email API service. When a business replies to the email, it goes directly to the customer!

## How It Works

1. **Customer fills out contact form** → Includes their name, email, phone, and message
2. **Email sent to business** → Business receives a beautiful HTML email with:
   - Customer's contact information
   - Their message
   - Customer's email set as "Reply-To"
3. **Business replies** → When they click reply, their email client automatically addresses it to the customer's email
4. **Customer gets the response** → Direct communication established!

## Setup Steps

### 1. Create a Resend Account

1. Go to [resend.com](https://resend.com)
2. Sign up for a free account
3. Verify your email address

### 2. Get Your API Key

1. In the Resend dashboard, go to **API Keys**
2. Click **Create API Key**
3. Give it a name (e.g., "ResourceAble Production")
4. Copy the API key (starts with `re_`)

### 3. Add to Environment Variables

Add the API key to your `.env` file:

```bash
RESEND_API_KEY="re_your_api_key_here"
```

### 4. Verify a Domain (For Production)

**For Testing (Default):**
- Resend allows sending to verified email addresses
- You can add test email addresses in the Resend dashboard
- Emails will work but have limitations

**For Production (Recommended):**
1. Go to **Domains** in Resend dashboard
2. Click **Add Domain**
3. Enter your domain (e.g., `resourceable.com`)
4. Add the DNS records to your domain provider:
   - SPF record
   - DKIM record
   - DMARC record (optional but recommended)
5. Wait for verification (usually 15 minutes)

### 5. Update the "From" Address

In `lib/email.ts`, update line 30:

```typescript
from: 'ResourceAble <noreply@yourdomain.com>', // Replace with your verified domain
```

Change to:
```typescript
from: 'ResourceAble <noreply@resourceable.com>', // Your actual domain
```

## Email Features

✅ **Reply-To Header**: When businesses reply, it goes to customer's email
✅ **Beautiful HTML Design**: Professional, branded email template
✅ **Plain Text Fallback**: For email clients that don't support HTML
✅ **Mobile Responsive**: Looks great on all devices
✅ **One-Click Reply**: Businesses can click a button to reply
✅ **Customer Info Display**: Name, email, phone all visible
✅ **Service Context**: Shows which service they inquired about

## Testing

### Test Locally:

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Go to search page and click "Contact" on any service

3. Fill out the form with a test email address

4. Check your Resend dashboard → **Emails** to see the sent email

### Add Test Recipients:

In Resend dashboard:
1. Go to **Settings** → **Email Addresses**
2. Add your test email addresses
3. Verify them via the email you receive

## Pricing

**Free Tier:**
- 100 emails per day
- 3,000 emails per month
- Perfect for getting started!

**Paid Plans:**
- Start at $20/month for 50,000 emails
- Pay as you go options available

## Troubleshooting

### Email Not Sending?

1. **Check API Key**: Make sure `RESEND_API_KEY` is set in `.env`
2. **Restart Server**: After adding env variables, restart your dev server
3. **Check Logs**: Look at terminal output for error messages
4. **Verify Recipients**: In test mode, email must be verified in Resend

### Email Goes to Spam?

1. **Verify Your Domain**: Use a custom domain with proper DNS records
2. **Add DMARC**: Improves email deliverability
3. **Avoid Spam Words**: Don't use ALL CAPS or excessive exclamation marks
4. **Test SPF/DKIM**: Use [mail-tester.com](https://www.mail-tester.com) to check

### Business Replies Not Working?

- The reply-to header is set automatically
- Test by sending to yourself and clicking "Reply"
- Make sure customer email address is valid

## Code Structure

- **`lib/email.ts`**: Email template and sending logic
- **`app/api/contact/route.ts`**: API endpoint that handles form submission
- **`components/search/ContactModal.tsx`**: Form UI component

## Email Template Customization

To customize the email design, edit `lib/email.ts`:

- **Colors**: Change the gradient colors in the header
- **Logo**: Add your logo image
- **Footer**: Update company information
- **Styling**: Modify the CSS in the `<style>` tag

## Alternative Email Services

If you prefer a different service, you can swap Resend with:
- **SendGrid**: Popular enterprise option
- **Mailgun**: Developer-friendly
- **Amazon SES**: Cheap for high volume
- **Postmark**: Great for transactional emails

Just replace the `sendContactInquiryEmail` function in `lib/email.ts` with your preferred service's API.

## Security Notes

⚠️ **Never commit your API key to git!**
- API keys are in `.env` (which is gitignored)
- Use environment variables in production
- Rotate keys if exposed

✅ **Form Validation**: All inputs are validated with Zod
✅ **Rate Limiting**: Consider adding rate limiting in production
✅ **Spam Protection**: Consider adding reCAPTCHA for public forms

## Next Steps

1. ✅ Get Resend API key
2. ✅ Add to `.env` file
3. ✅ Test the contact form
4. ⏳ Verify your domain (for production)
5. ⏳ Customize email template with your branding
6. ⏳ Set up monitoring for failed emails

---

Need help? Check the [Resend Documentation](https://resend.com/docs)
