import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AdminActionType } from '@prisma/client';

/**
 * Returns the session only if the caller is an authenticated ADMIN, else null.
 * Centralizes the server-side RBAC check so every admin route enforces it identically.
 */
export async function getAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return null;
  }
  // The role claim lives in a long-lived JWT. Re-check the live DB record so a
  // demoted or deactivated admin loses access immediately, not when their token
  // eventually expires. Cheap here — admin endpoints are low-traffic.
  const current = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, isActive: true },
  });
  if (!current || current.role !== 'ADMIN' || !current.isActive) {
    return null;
  }
  return session;
}

interface LogAdminActionInput {
  adminId: string;
  action: AdminActionType;
  targetType: 'Business' | 'ServiceType' | 'Disability' | 'Report' | 'Resource';
  targetId: string;
  targetLabel?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Appends one immutable row to the admin audit log. Logging failures are swallowed
 * (logged to console) so an audit-write problem never blocks the underlying action.
 * Bulk operations MUST call this once per item so each action is individually attributable.
 */
export async function logAdminAction(input: LogAdminActionInput) {
  try {
    await prisma.adminAction.create({
      data: {
        adminId: input.adminId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        targetLabel: input.targetLabel ?? null,
        reason: input.reason ?? null,
        metadata: input.metadata ? (input.metadata as any) : undefined,
      },
    });
  } catch (error) {
    console.error('Failed to write admin audit log entry:', error);
  }
}
