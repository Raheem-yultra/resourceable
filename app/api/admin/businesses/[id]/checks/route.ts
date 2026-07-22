import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession, logAdminAction } from '@/lib/admin';
import { runVerificationChecks, summarizeChecks } from '@/lib/verification';

export const dynamic = 'force-dynamic';

// Re-runs the automated pre-approval checks on demand (lib/verification).
//
// Deliberately POST, not GET: it hits third-party endpoints and writes results. It
// never changes verificationStatus or verificationLevel — approval stays manual, and
// this only refreshes the evidence the admin sees.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { id: params.id },
      select: { id: true, businessName: true },
    });
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const outcomes = await runVerificationChecks(business.id);
    const summary = summarizeChecks(outcomes);

    await logAdminAction({
      adminId: session.user.id,
      action: 'BUSINESS_CHECKS_RUN',
      targetType: 'Business',
      targetId: business.id,
      targetLabel: business.businessName,
      metadata: { verdict: summary.verdict, pass: summary.pass, warn: summary.warn, fail: summary.fail },
    });

    return NextResponse.json({
      checks: outcomes.map((o) => ({
        type: o.type,
        result: o.result,
        summary: o.summary,
        details: o.details ?? null,
        checkedAt: new Date().toISOString(),
      })),
      summary,
      success: true,
    });
  } catch (error) {
    console.error('Run verification checks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
