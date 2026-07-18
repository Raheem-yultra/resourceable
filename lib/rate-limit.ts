import { NextResponse } from 'next/server';

/**
 * Best-effort, dependency-free rate limiter for abuse-prone UNAUTHENTICATED
 * endpoints (email-sending, account creation).
 *
 * IMPORTANT: state is in-memory and PER-PROCESS. On serverless/Vercel each
 * instance keeps its own map, so this is a speed bump against casual abuse from a
 * single source — NOT a strict global limit. For hard guarantees use a shared
 * store (e.g. Upstash Redis / @upstash/ratelimit). This limiter deliberately
 * FAILS OPEN (never blocks legit traffic on error) and bounds its own memory.
 */

type Bucket = { count: number; resetAt: number };

const BUCKETS = new Map<string, Bucket>();
const MAX_KEYS = 10_000; // hard cap so a flood of unique keys can't exhaust memory

function prune(now: number) {
  if (BUCKETS.size < MAX_KEYS) return;
  // Drop expired windows first.
  for (const [key, b] of BUCKETS) {
    if (b.resetAt <= now) BUCKETS.delete(key);
  }
  // Still full of live windows? Evict the soonest-expiring 10%.
  if (BUCKETS.size >= MAX_KEYS) {
    const sorted = [...BUCKETS.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    const drop = Math.ceil(MAX_KEYS * 0.1);
    for (let i = 0; i < drop && i < sorted.length; i++) BUCKETS.delete(sorted[i][0]);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window limiter. Records a hit for `key`; returns allowed=false once
 * `limit` hits occur within `windowMs`. Fails open on any internal error.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  try {
    const now = Date.now();
    prune(now);
    const existing = BUCKETS.get(key);
    if (!existing || existing.resetAt <= now) {
      BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
    }
    if (existing.count >= limit) {
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
    }
    existing.count += 1;
    return { allowed: true, remaining: limit - existing.count, retryAfterSeconds: 0 };
  } catch {
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  }
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

/** Standard 429 response with a Retry-After header. */
export function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: 'Too many requests. Please slow down and try again shortly.' },
    { status: 429, headers: { 'retry-after': String(Math.max(1, retryAfterSeconds)) } }
  );
}
