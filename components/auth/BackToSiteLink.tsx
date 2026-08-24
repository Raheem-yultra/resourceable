import Link from 'next/link';

/**
 * The way out of an auth screen.
 *
 * The site header is not rendered anywhere under /auth (see ConditionalNavbar),
 * so without this every one of these pages is a dead end for anyone who arrived
 * by mistake or changed their mind. It belongs in EVERY return branch of those
 * pages, not just the main one — a success card or an invalid-token card is just
 * as much of a full screen as the form is.
 */
export function BackToSiteLink() {
  return (
    <div className="mt-6 text-center">
      <Link
        href="/"
        className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Back to ResourceAble
      </Link>
    </div>
  );
}
