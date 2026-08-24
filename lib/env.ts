/**
 * Centralized runtime configuration.
 *
 * The rule here: **a missing value must never degrade quietly in production.**
 * Before this module, every caller hand-rolled
 * `process.env.NEXTAUTH_URL || 'http://localhost:3000'`, so a deploy that forgot
 * to set it kept returning 200s while mailing users verification links pointing
 * at localhost — broken in the one way nobody notices until support tickets
 * arrive. The same applied to `EMAIL_FROM`: unset meant falling back to Resend's
 * shared sandbox sender, which is accepted by the API and delivered to nobody.
 *
 * Accessors are functions, not module constants, so they read the environment at
 * call time (constants would freeze whatever existed at import) and so throwing
 * can never break a build — only the request that actually needed the value.
 */

/** Resend's shared sandbox sender. Works in dev; delivers to almost nobody. */
export const SANDBOX_SENDER = 'onboarding@resend.dev';

const DEV_BASE_URL = 'http://localhost:3000';
const DEFAULT_SUPPORT_EMAIL = 'support@resourceable.com';

export const isProduction = (): boolean => process.env.NODE_ENV === 'production';

/**
 * Canonical public origin, without a trailing slash.
 *
 * Used for every link we email (verification, password reset, provider approval).
 * In production a missing value throws instead of falling back to localhost,
 * because a localhost link in a real user's inbox is worse than a logged error.
 */
export function getAppBaseUrl(): string {
  const url = process.env.NEXTAUTH_URL?.trim();
  if (url) return url.replace(/\/+$/, '');
  if (isProduction()) {
    throw new Error(
      'NEXTAUTH_URL is not set. It is required in production: every emailed link ' +
        'is built from it.'
    );
  }
  return DEV_BASE_URL;
}

/**
 * Canonical origin for build-time metadata — sitemap, robots, Open Graph URLs.
 *
 * Deliberately NEVER throws, unlike getAppBaseUrl(). Those callers run during
 * `next build`, where a missing NEXTAUTH_URL would take the whole build down; a
 * wrong canonical URL in a sitemap is a bad day, a failed deploy is a worse one.
 * Falls back to the origin Vercel injects, which is correct for both preview and
 * production deploys, before finally giving up and using localhost.
 */
export function getPublicBaseUrl(): string {
  const explicit = process.env.NEXTAUTH_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (vercelHost) return `https://${vercelHost.replace(/\/+$/, '')}`;

  return DEV_BASE_URL;
}

/**
 * The transactional sender ("From" header).
 *
 * In production an unset value throws rather than silently using the sandbox
 * sender. Callers already treat email failures as non-fatal, so the user still
 * gets their account — but the failure is loud in logs instead of invisible.
 */
export function getEmailFrom(): string {
  const from = process.env.EMAIL_FROM?.trim();
  if (from) return from;
  if (isProduction()) {
    throw new Error(
      `EMAIL_FROM is not set. Falling back to ${SANDBOX_SENDER} is a development ` +
        'convenience only — it cannot deliver to arbitrary recipients. Set it to a ' +
        'sender on a domain verified in Resend.'
    );
  }
  return `ResourceAble <${SANDBOX_SENDER}>`;
}

/** Reply-To on outbound mail. Never throws; a wrong value only misroutes replies. */
export function getSupportEmail(): string {
  return process.env.SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL;
}

export interface ConfigProblem {
  key: string;
  level: 'error' | 'warning';
  message: string;
}

/**
 * Static inspection of the current environment, for the preflight script and for
 * an ops/health endpoint. Pure — reports problems, never throws, sends nothing.
 */
export function checkProductionConfig(env: NodeJS.ProcessEnv = process.env): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  const val = (k: string) => env[k]?.trim() || '';

  const required = [
    ['DATABASE_URL', 'Prisma cannot reach the database without it.'],
    ['DIRECT_URL', 'Prisma migrations/db push need the non-pooled connection.'],
    ['NEXTAUTH_SECRET', 'Sessions cannot be signed without it.'],
    ['NEXTAUTH_URL', 'Every emailed link is built from it.'],
    ['RESEND_API_KEY', 'All transactional email silently fails without it.'],
    ['EMAIL_FROM', 'Unset falls back to the Resend sandbox sender, which delivers to nobody.'],
  ] as const;

  for (const [key, why] of required) {
    if (!val(key)) problems.push({ key, level: 'error', message: `Not set. ${why}` });
  }

  const url = val('NEXTAUTH_URL');
  if (url && !/^https:\/\//i.test(url)) {
    problems.push({
      key: 'NEXTAUTH_URL',
      level: 'error',
      message: `Must be an https:// URL in production (got "${url}"). Emailed links and OAuth callbacks depend on it.`,
    });
  }
  if (url && /\/$/.test(url)) {
    problems.push({
      key: 'NEXTAUTH_URL',
      level: 'warning',
      message: 'Has a trailing slash; it is stripped at runtime, but set it without one to avoid confusion.',
    });
  }

  const from = val('EMAIL_FROM');
  if (from && from.includes(SANDBOX_SENDER)) {
    problems.push({
      key: 'EMAIL_FROM',
      level: 'error',
      message: `Uses the Resend sandbox sender (${SANDBOX_SENDER}). It only delivers to your own Resend account address and @resend.dev test inboxes — real users receive nothing.`,
    });
  }

  if (!val('SUPPORT_EMAIL')) {
    problems.push({
      key: 'SUPPORT_EMAIL',
      level: 'warning',
      message: `Not set; Reply-To on all outbound mail defaults to ${DEFAULT_SUPPORT_EMAIL}. Replies bounce if that mailbox does not exist.`,
    });
  }

  const secret = val('NEXTAUTH_SECRET');
  if (secret && secret.length < 32) {
    problems.push({
      key: 'NEXTAUTH_SECRET',
      level: 'error',
      message: `Only ${secret.length} characters. Use 32+ bytes: openssl rand -base64 32`,
    });
  }

  const db = val('DATABASE_URL');
  const direct = val('DIRECT_URL');
  if (db && direct && db === direct) {
    problems.push({
      key: 'DIRECT_URL',
      level: 'error',
      message: 'Identical to DATABASE_URL. The transaction pooler cannot run DDL, so prisma db push will hang. DIRECT_URL must use port 5432 without pgbouncer.',
    });
  }

  return problems;
}
