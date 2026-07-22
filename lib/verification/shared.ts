// Pure, dependency-free helpers shared by the server checks and the admin UI.
//
// Kept separate from ./index and ./checks on purpose: those import Prisma and
// node:dns, so importing them from a 'use client' component would drag server-only
// modules into the browser bundle. Anything both sides need lives here.

export type CheckResult = 'PASS' | 'WARN' | 'FAIL' | 'SKIPPED' | 'ERROR';

export type CheckType = 'EMAIL_DOMAIN' | 'WEBSITE' | 'PHONE' | 'ADDRESS' | 'DUPLICATE' | 'NPI';

/** Display order in the admin queue: strongest evidence first. */
export const CHECK_ORDER: CheckType[] = ['NPI', 'DUPLICATE', 'EMAIL_DOMAIN', 'WEBSITE', 'ADDRESS', 'PHONE'];

export const CHECK_LABELS: Record<CheckType, string> = {
  NPI: 'NPI registry (NPPES)',
  DUPLICATE: 'Duplicate provider',
  EMAIL_DOMAIN: 'Email domain',
  WEBSITE: 'Website',
  ADDRESS: 'Address',
  PHONE: 'Phone',
};

/** What each check actually proves — shown as help text so PASS isn't over-read. */
export const CHECK_DESCRIPTIONS: Record<CheckType, string> = {
  NPI: 'Matches an active record in the public CMS provider registry',
  DUPLICATE: 'Collides with an existing, rejected, or suspended provider',
  EMAIL_DOMAIN: 'Verified account email sits on the business’s own domain',
  WEBSITE: 'Domain resolves, serves a live site, and has registration history',
  ADDRESS: 'Street address exists in the US Census address file',
  PHONE: 'Format is dialable — ownership only if corroborated by NPPES',
};

export type Verdict = 'CLEAR' | 'REVIEW' | 'BLOCKED' | 'UNKNOWN';

export interface CheckSummary {
  verdict: Verdict;
  pass: number;
  warn: number;
  fail: number;
  total: number;
}

/**
 * Rolls the individual results into one queue-level verdict.
 * ERROR is intentionally NOT treated as a problem with the provider — it means we
 * couldn't reach a source, so it degrades to "review" rather than "blocked".
 * CLEAR requires at least one corroborating PASS: an application where every check was
 * SKIPPED (the provider supplied nothing verifiable) is "review", never "clear".
 */
export function summarizeChecks(checks: Array<{ result: string }>): CheckSummary {
  if (checks.length === 0) return { verdict: 'UNKNOWN', pass: 0, warn: 0, fail: 0, total: 0 };
  const pass = checks.filter((c) => c.result === 'PASS').length;
  const warn = checks.filter((c) => c.result === 'WARN').length;
  const fail = checks.filter((c) => c.result === 'FAIL').length;
  const errored = checks.filter((c) => c.result === 'ERROR').length;
  if (fail > 0) return { verdict: 'BLOCKED', pass, warn, fail, total: checks.length };
  if (warn > 0 || errored > 0 || pass === 0) return { verdict: 'REVIEW', pass, warn, fail, total: checks.length };
  return { verdict: 'CLEAR', pass, warn, fail, total: checks.length };
}

export function verdictLabel(summary: CheckSummary): string {
  switch (summary.verdict) {
    case 'CLEAR':
      return 'All checks clear';
    case 'REVIEW':
      // Zero corroboration (everything skipped/errored) reads better as its own phrase
      // than "N to review", which implies findings that aren't there.
      if (summary.pass === 0 && summary.warn === 0) return 'Nothing verified yet';
      return `${summary.warn || summary.total - summary.pass} to review`;
    case 'BLOCKED':
      return `${summary.fail} failed`;
    default:
      return 'Checks not run';
  }
}
