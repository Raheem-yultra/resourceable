// Orchestrates the automated pre-approval checks for one provider application and
// persists the evidence for the admin queue.
//
// These checks NEVER change verificationStatus or verificationLevel. Approval stays a
// human decision — the point is to turn "investigate this provider" into "adjudicate
// the exceptions", by putting corroborated evidence in front of the admin.

import { prisma } from '@/lib/prisma';
import type { VerificationCheckResult, VerificationCheckType } from '@prisma/client';
import {
  checkAddress,
  checkDuplicate,
  checkEmailDomain,
  checkNpi,
  checkPhone,
  checkWebsite,
  type BusinessSnapshot,
  type CheckOutcome,
} from './checks';

export type { BusinessSnapshot, CheckOutcome } from './checks';
// Labels/summarizing live in ./shared so the admin client component can use them
// without pulling Prisma and node:dns into the browser bundle.
export { CHECK_LABELS, CHECK_ORDER, summarizeChecks, verdictLabel } from './shared';
export type { CheckSummary, Verdict } from './shared';

/**
 * Runs every check for a business and upserts the results.
 *
 * Network checks run in parallel behind a 5s per-request timeout, so a full run costs
 * roughly one round-trip in wall-clock time. Individual failures degrade to ERROR
 * rather than throwing — a dead external endpoint must never block an application.
 */
export async function runVerificationChecks(businessId: string): Promise<CheckOutcome[]> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true, businessName: true, email: true, phone: true, website: true,
      address: true, addressLine2: true, city: true, state: true, zipCode: true,
      npi: true, latitude: true, longitude: true,
      user: { select: { email: true, emailVerified: true } },
    },
  });
  if (!business) throw new Error('Business not found');

  const snapshot: BusinessSnapshot = {
    id: business.id,
    businessName: business.businessName,
    email: business.email,
    phone: business.phone,
    website: business.website,
    address: business.address,
    addressLine2: business.addressLine2,
    city: business.city,
    state: business.state,
    zipCode: business.zipCode,
    npi: business.npi,
    accountEmail: business.user.email,
    accountEmailVerified: business.user.emailVerified != null,
  };

  // All four network checks run concurrently so wall-clock time is one round-trip, not
  // the sum — this runs inline on the provider's save, so worst-case latency matters
  // (a serverless function timeout would otherwise fail the save). The phone check only
  // reuses the NPI's registry phone, so it's computed after npi resolves but still
  // inside the same parallel window.
  const [npiOutcome, websiteOutcome, addressOutcome, duplicateOutcome] = await Promise.all([
    checkNpi(snapshot),
    checkWebsite(snapshot),
    checkAddress(snapshot),
    checkDuplicate(snapshot),
  ]);

  const outcomes: CheckOutcome[] = [
    npiOutcome,
    checkEmailDomain(snapshot),
    websiteOutcome,
    checkPhone(snapshot, npiOutcome.nppesPhone),
    addressOutcome,
    duplicateOutcome,
  ];

  await prisma.$transaction([
    ...outcomes.map((outcome) =>
      prisma.verificationCheck.upsert({
        where: { businessId_type: { businessId, type: outcome.type as VerificationCheckType } },
        create: {
          businessId,
          type: outcome.type as VerificationCheckType,
          result: outcome.result as VerificationCheckResult,
          summary: outcome.summary,
          details: (outcome.details ?? undefined) as any,
        },
        update: {
          result: outcome.result as VerificationCheckResult,
          summary: outcome.summary,
          details: (outcome.details ?? undefined) as any,
          checkedAt: new Date(),
        },
      })
    ),
    prisma.business.update({
      where: { id: businessId },
      data: {
        checksRunAt: new Date(),
        // The Census geocoder hands back coordinates for free while validating the
        // address — backfill them if we don't have any, so map/distance features and
        // the admin's location sanity-check work without a separate geocoding pass.
        ...(addressOutcome.geocode && business.latitude == null && business.longitude == null
          ? { latitude: addressOutcome.geocode.latitude, longitude: addressOutcome.geocode.longitude }
          : {}),
      },
    }),
  ]);

  return outcomes;
}
