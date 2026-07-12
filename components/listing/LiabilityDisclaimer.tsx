import { Info } from 'lucide-react';

/**
 * Liability / trust disclaimer (plan §4/§7.9). Must be visible at the point of
 * decision — listing cards/detail and browse — not buried in a terms page.
 * NOTE: recommend legal review of this language before launch given the population served.
 */
export function LiabilityDisclaimer({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-muted/50 p-3 sm:p-4 ${className}`}>
      <div className="flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-xs sm:text-sm text-muted-foreground">
          ResourceAble is a directory of third-party providers. We do not directly provide, endorse, or
          guarantee any listed service, product, program, or event. Verify credentials independently and
          use your own judgment before engaging a provider.
        </p>
      </div>
    </div>
  );
}
