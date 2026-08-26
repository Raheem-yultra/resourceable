'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * "Back" that actually goes back.
 *
 * Detail pages used to link to a fixed route — `/browse`, `/search` — which meant
 * a visitor who arrived from "Speech Therapy, autism, within 10 miles of 60601"
 * landed on an unfiltered list and had to rebuild the search from scratch. Filter
 * state now lives in the URL, so `router.back()` restores it exactly.
 *
 * The fallback matters for the case the history stack cannot cover: a shared link
 * opened cold in a new tab has nothing behind it, and `back()` would leave the
 * visitor sitting on the same page wondering why nothing happened.
 */
export function BackLink({
  fallbackHref,
  label = 'Back',
  className,
}: {
  fallbackHref: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  // Always a real anchor pointing at the fallback: it works before hydration, and
  // right-click / middle-click / "open in new tab" all behave. The history check
  // happens at click time rather than on mount, which is both more accurate and
  // avoids holding render-blocking state for something only a click needs.
  return (
    <Link
      href={fallbackHref}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground',
        className
      )}
      onClick={(e) => {
        // Let modified clicks (new tab/window) use the real href.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        // Nothing to go back to — a shared link opened cold. Let the href run.
        if (window.history.length <= 1) return;
        e.preventDefault();
        router.back();
      }}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {label}
    </Link>
  );
}
