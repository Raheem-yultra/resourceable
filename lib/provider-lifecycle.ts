import { prisma } from '@/lib/prisma';
import { getAppBaseUrl } from '@/lib/env';
import { sendProviderApprovedEmail } from '@/lib/email';

/**
 * Side effects to run when a provider is approved.
 *
 * Approval is the only gate on going live: once an admin approves a business,
 * its listings are visible to families and it can respond to messages. Nothing
 * else is required of the provider, so this is purely a notification.
 *
 * Fully self-contained and error-swallowing — notifying the provider must never
 * block or fail the approval itself.
 */
export async function onBusinessApproved(businessId: string): Promise<void> {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { user: { select: { email: true, name: true } } },
    });
    if (!business) return;

    await sendProviderApprovedEmail({
      email: business.user.email,
      name: business.user.name || 'Business Owner',
      businessName: business.businessName,
      actionUrl: `${getAppBaseUrl()}/business/dashboard`,
    }).catch((e) => console.error('[provider] approval email failed:', e));
  } catch (e) {
    console.error('[provider] onBusinessApproved failed:', e);
  }
}
