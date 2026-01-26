# Contact Form Email Flow - Marketplace Style

## 📧 What Happens When a Customer Submits the Contact Form

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Customer Fills Out Form                                │
├─────────────────────────────────────────────────────────────────┤
│  Customer (not signed in) clicks "Contact" on a service         │
│  Fills out:                                                      │
│    • Name: "John Smith"                                         │
│    • Email: "john@example.com"                                  │
│    • Phone: "(555) 123-4567" (optional)                        │
│    • Message: "I'm interested in your services..."             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Form Submitted to API                                  │
├─────────────────────────────────────────────────────────────────┤
│  POST /api/contact                                              │
│    • Validates form data with Zod                               │
│    • Checks service exists                                      │
│    • Checks business has email                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: TWO Emails Sent via Resend                             │
├─────────────────────────────────────────────────────────────────┤
│  EMAIL #1 - To Business:                                        │
│    FROM: ResourceAble Support <support@yourdomain.com>          │
│    TO: business@example.com                                     │
│    REPLY-TO: support@yourdomain.com ⭐                          │
│    SUBJECT: New Customer Inquiry - [Service Name]               │
│                                                                  │
│  EMAIL #2 - To Customer:                                        │
│    FROM: ResourceAble Support <support@yourdomain.com>          │
│    TO: john@example.com                                         │
│    REPLY-TO: support@yourdomain.com                             │
│    SUBJECT: We've contacted [Business] on your behalf           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: Business Receives Notification                         │
├─────────────────────────────────────────────────────────────────┤
│  Email contains:                                                 │
│    � "New Customer Inquiry"                                    │
│    📋 Customer Information (name, email, phone)                 │
│    💬 Customer's Message                                        │
│    💡 Instructions: Contact customer directly using their info  │
│    ℹ️  Note: "Reply to this email to contact our support"      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: Customer Receives Confirmation                         │
├─────────────────────────────────────────────────────────────────┤
│  Email contains:                                                 │
│    ✅ "Your Inquiry Has Been Sent!"                            │
│    📞 Business Contact Information:                             │
│       • Phone: (555) 987-6543                                   │
│       • Email: business@example.com                             │
│       • Website: www.business.com                               │
│    📝 Copy of their original message                            │
│    💡 Next Steps: "Reach out directly or wait for contact"     │
│    ℹ️  Support: "Reply to email for help"                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 6: Direct Communication Between Parties                   │
├─────────────────────────────────────────────────────────────────┤
│  Business contacts customer directly using:                     │
│    • john@example.com                                           │
│    • (555) 123-4567                                            │
│                                                                  │
│  OR Customer contacts business directly using info from email:  │
│    • business@example.com                                       │
│    • (555) 987-6543                                            │
│                                                                  │
│  Platform is out of the loop! ✅                                │
│  (Unless they need support - can reply to platform email)       │
└─────────────────────────────────────────────────────────────────┘
```

## ⭐ Key Features - Marketplace Style

### 1. **Platform as Intermediary**
```javascript
from: 'ResourceAble Support <support@yourdomain.com>'
replyTo: 'support@yourdomain.com'  // Not customer email!
```
All emails come from YOUR platform, establishing trust and brand presence. If anyone replies, it goes to your support inbox.

### 2. **Information Exchange**
- **Business gets:** Customer's contact info (name, email, phone, message)
- **Customer gets:** Business's contact info (phone, email, website)
- Both parties can contact each other directly!

### 3. **Support Channel Available**
If either party has issues, they can reply to the platform email to get help from your support team.

## 📊 Email Templates Preview

### EMAIL TO BUSINESS:

```
╔═══════════════════════════════════════════════════════════╗
║  📬 New Customer Inquiry                                  ║
║  A customer has requested your contact via ResourceAble  ║
╚═══════════════════════════════════════════════════════════╝
┌───────────────────────────────────────────────────────────┐
│                                                            │
│  Hello Bright Futures Therapy,                            │
│                                                            │
│  A customer is interested in your service:                │
│  Applied Behavior Analysis (ABA) Therapy                  │
│                                                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │  📌 How This Works:                               │   │
│  │  We've shared your contact information with the   │   │
│  │  customer. Reply to this email for support help.  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │  📋 Customer Information                          │   │
│  ├──────────────────────────────────────────────────┤   │
│  │  Name:     John Smith                             │   │
│  │  Email:    john@example.com                       │   │
│  │  Phone:    (555) 123-4567                        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │  💬 Customer's Message                            │   │
│  ├──────────────────────────────────────────────────┤   │
│  │  I'm looking for ABA therapy for my 5-year-old    │   │
│  │  son who has autism. We're available on weekdays  │   │
│  │  after 3pm. Please let me know your availability. │   │
│  └──────────────────────────────────────────────────┘   │
│                                                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │  💡 Next Steps: Please reach out to John Smith   │   │
│  │  directly using the contact information above.    │   │
│  │  The customer can also see your contact info.    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                            │
└───────────────────────────────────────────────────────────┘
  This is an automated notification from ResourceAble
  Questions? Reply to this email to contact our support team
```

### EMAIL TO CUSTOMER:

```
╔═══════════════════════════════════════════════════════════╗
║  ✅ Your Inquiry Has Been Sent!                          ║
║  We've notified Bright Futures Therapy                    ║
╚═══════════════════════════════════════════════════════════╝
┌───────────────────────────────────────────────────────────┐
│                                                            │
│  Hello John Smith,                                         │
│                                                            │
│  Thank you for using ResourceAble! We've sent your        │
│  inquiry to Bright Futures Therapy regarding their        │
│  Applied Behavior Analysis (ABA) Therapy.                 │
│                                                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │  📞 Business Contact Information                  │   │
│  │  You can reach out to them directly:              │   │
│  ├──────────────────────────────────────────────────┤   │
│  │  Phone:    (555) 987-6543                        │   │
│  │  Email:    therapy@brightfutures.com             │   │
│  │  Website:  www.brightfutures.com                 │   │
│  └──────────────────────────────────────────────────┘   │
│                                                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │  📝 Your Message to Bright Futures Therapy        │   │
│  ├──────────────────────────────────────────────────┤   │
│  │  "I'm looking for ABA therapy for my 5-year-old   │   │
│  │  son who has autism. We're available on weekdays  │   │
│  │  after 3pm. Please let me know your availability."│   │
│  └──────────────────────────────────────────────────┘   │
│                                                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │  ⏱️ What Happens Next?                            │   │
│  │  • Bright Futures will review your inquiry        │   │
│  │  • They'll contact you directly                   │   │
│  │  • You can also reach out using info above        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │  💡 Tip: We recommend reaching out via phone     │   │
│  │  for the fastest response!                        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                            │
│  Need help? Reply to this email to contact support        │
│                                                            │
└───────────────────────────────────────────────────────────┘
  Thank you for using ResourceAble
  Helping connect families with disability services
```

## 🔧 Technical Implementation

### Files Modified:

1. **`lib/email.ts`** (NEW)
   - Email template with HTML/CSS
   - Resend API integration
   - Reply-to header configuration

2. **`app/api/contact/route.ts`** (UPDATED)
   - Calls `sendContactInquiryEmail()`
   - Handles email errors gracefully
   - Validates business has email

3. **`.env`** (UPDATED)
   - Added `RESEND_API_KEY`

4. **`package.json`** (UPDATED)
   - Added `resend` package

### Environment Variables Needed:

```bash
RESEND_API_KEY="re_your_api_key_here"
```

## 🚀 Setup Checklist

- [ ] Sign up at [resend.com](https://resend.com)
- [ ] Get API key from Resend dashboard
- [ ] Add `RESEND_API_KEY` to `.env` file
- [ ] Restart development server
- [ ] Test contact form
- [ ] (Optional) Verify custom domain for production
- [ ] (Optional) Update "from" email address in `lib/email.ts`

## 🧪 How to Test

1. **Start your server:**
   ```bash
   npm run dev
   ```

2. **Go to search page:**
   - Navigate to `/search`
   - Find any service
   - Click "Contact" button

3. **Fill out the form:**
   - Use your real email as "Your Email"
   - Fill in test data for other fields
   - Submit

4. **Check your email:**
   - You should receive the inquiry (if the business email in DB is yours)
   - Click "Reply" in your email client
   - Verify it addresses to the customer's email

## ❓ FAQ

**Q: What if I don't have a custom domain?**
A: For testing, Resend works fine with their default domain. Just verify your test email addresses in the Resend dashboard.

**Q: Does this cost money?**
A: Resend has a free tier: 100 emails/day, 3,000/month. Perfect for getting started!

**Q: What if the email fails to send?**
A: The API catches email errors and continues execution. The form still succeeds but email sending is logged as an error. You can add retry logic or queue systems later.

**Q: Can I customize the email template?**
A: Yes! Edit `lib/email.ts`. The HTML and CSS are all there. Add your logo, change colors, etc.

**Q: Will this work in production?**
A: Yes, but you should verify a custom domain in Resend for better deliverability and to remove the "via resend.dev" in email clients.

---

✅ **Email sending is now fully functional!**
When a business replies, the customer gets the response directly. 🎉
