import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Crumb {
  name: string;
  path: string;
}

/**
 * The trail from the homepage to this page.
 *
 * Two jobs at once. For a visitor arriving cold on a shared listing link — which
 * is most of this site's traffic — it is the only thing on the page saying what
 * section they have landed in and offering a way up; "Back to results" means
 * nothing when there are no results behind you. For a crawler, the matching
 * BreadcrumbList markup is what replaces the raw URL in a search result with a
 * readable hierarchy.
 *
 * The same array feeds both, because Google's guidance is that breadcrumb markup
 * should describe a trail the visitor can actually see, and because two lists that
 * can disagree eventually will.
 *
 * The final crumb is the current page: rendered as text, not a link, and marked
 * aria-current so a screen reader announces it as the destination rather than as
 * one more place to go.
 */
export function Breadcrumbs({ trail, className }: { trail: Crumb[]; className?: string }) {
  if (trail.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-muted-foreground sm:text-sm">
        {trail.map((crumb, i) => {
          const isLast = i === trail.length - 1;
          return (
            <li key={crumb.path} className="flex min-w-0 items-center gap-1">
              {i > 0 && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
              )}
              {isLast ? (
                <span aria-current="page" className="truncate font-medium text-foreground">
                  {crumb.name}
                </span>
              ) : (
                <Link href={crumb.path} className="shrink-0 underline-offset-4 hover:text-foreground hover:underline">
                  {crumb.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
