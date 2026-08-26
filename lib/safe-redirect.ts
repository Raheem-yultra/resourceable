/**
 * Reduce a requested post-auth destination to a safe, same-origin path.
 *
 * Two things have to be true of anything we redirect to after sign-in, and they
 * pull in opposite directions:
 *
 *  1. It must not leave the site. A `?callbackUrl=https://evil.example` in a
 *     link someone was sent would hand an attacker a redirect that happens
 *     immediately after the user typed their password — the most convincing
 *     possible moment to land on a lookalike page.
 *
 *  2. It must still work for the URLs NextAuth actually produces. NextAuth
 *     rewrites `callbackUrl=/messages` into the absolute
 *     `http://localhost:3000/messages` before handing it to the sign-in page, so
 *     a naive "must start with /" check rejects the site's own redirects and
 *     quietly drops everyone back on their role's landing page. Which is the bug
 *     this whole change set out to fix.
 *
 * So: accept a relative path, accept an absolute URL whose origin is ours, and
 * return a path in both cases. Reject everything else, including protocol-relative
 * `//evil.example` (which a browser reads as an absolute URL, not a path).
 */
export function safeCallbackPath(raw: string | null | undefined, origin?: string): string | null {
  if (!raw) return null;

  const currentOrigin = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');

  try {
    // A base is required for relative inputs; using our own origin also means a
    // same-origin absolute input parses to exactly the same thing.
    const url = new URL(raw, currentOrigin || 'http://localhost');

    if (currentOrigin && url.origin !== currentOrigin) return null;

    const path = `${url.pathname}${url.search}${url.hash}`;

    // Never bounce back to the auth screens themselves — that is either a loop or
    // a no-op, and both look to the user like sign-in silently failed.
    if (path.startsWith('/auth/') || path.startsWith('/api/auth/')) return null;

    return path.startsWith('/') ? path : null;
  } catch {
    // Not parseable as a URL at all.
    return null;
  }
}
