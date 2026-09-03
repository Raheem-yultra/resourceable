import type { Metadata } from 'next';

/**
 * Metadata for the whole auth flow.
 *
 * Every screen under /auth is a client component, and a client component cannot
 * export `metadata` — so without this layout the sign-in, sign-up, reset and
 * verify pages were the only routes on the site with nothing of their own to say.
 *
 * `noindex` because none of them is a destination: a search result pointing at a
 * password reset form helps nobody, and an indexed sign-in page competes with the
 * homepage for the site's own brand query. robots.txt already disallows /auth/,
 * but a disallowed URL can still be indexed without its content if something links
 * to it — this is the directive that actually prevents that, and it is the one
 * that still holds if robots.txt is ever loosened.
 *
 * `follow` stays on so the links back into the site still pass through.
 */
export const metadata: Metadata = {
  title: 'Sign in - ResourceAble',
  robots: { index: false, follow: true },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
