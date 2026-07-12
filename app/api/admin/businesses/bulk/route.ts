import { NextRequest, NextResponse } from 'next/server';
import { businessService } from '@/services/business.service';
import { getAdminSession, logAdminAction } from '@/lib/admin';
import { onBusinessApproved } from '@/lib/billing';
import { z } from 'zod';

// Bulk approve/reject. Each item is applied and audit-logged INDIVIDUALLY
// (never a single opaque "bulk" event), so every business remains attributable.
const bulkSchema = z.object({
  action: z.enum(['approve', 'reject']),
  ids: z.array(z.string().cuid()).min(1, 'Select at least one business').max(100, 'Too many at once (max 100)'),
  reason: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = bulkSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { action, ids, reason } = parsed.data;
    const status = action === 'approve' ? 'APPROVED' : 'REJECTED';

    if (action === 'reject' && !reason?.trim()) {
      return NextResponse.json(
        { error: 'A reason is required to bulk-reject' },
        { status: 400 }
      );
    }

    // De-duplicate ids defensively
    const uniqueIds = Array.from(new Set(ids));
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];

    for (const id of uniqueIds) {
      try {
        const business = await businessService.updateVerificationStatus(id, status, {
          rejectionReason: action === 'reject' ? reason : undefined,
          reviewedBy: session.user.id,
        });
        // One audit row per business
        await logAdminAction({
          adminId: session.user.id,
          action: action === 'approve' ? 'BUSINESS_APPROVED' : 'BUSINESS_REJECTED',
          targetType: 'Business',
          targetId: business.id,
          targetLabel: business.businessName,
          reason: action === 'reject' ? reason : undefined,
          metadata: { viaBulk: true },
        });
        // Billing onboarding on approval (best-effort, never throws)
        if (action === 'approve') {
          await onBusinessApproved(business.id);
        }
        results.push({ id, ok: true });
      } catch (err: any) {
        results.push({ id, ok: false, error: err?.message || 'Failed' });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    return NextResponse.json({
      message: `${succeeded} of ${uniqueIds.length} business${uniqueIds.length !== 1 ? 'es' : ''} ${action === 'approve' ? 'approved' : 'rejected'}`,
      results,
      summary: { succeeded, failed: uniqueIds.length - succeeded },
    });
  } catch (error) {
    console.error('Bulk business action error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
