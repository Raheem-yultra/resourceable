import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Check, Circle, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import type { SetupStep, StepStatus } from '@/lib/business-setup';

/**
 * The provider's map of where they are.
 *
 * Server component: every input is already loaded by the page's own query, so
 * there is nothing to hydrate on the client. Rendered on the dashboard in full,
 * and in `compact` form as a header on the two setup pages so a provider never
 * loses the thread of what comes next.
 */

const STATUS_ICON: Record<StepStatus, React.ComponentType<{ className?: string }>> = {
  complete: Check,
  current: Circle,
  todo: Circle,
  waiting: Clock,
  blocked: AlertTriangle,
};

const STATUS_STYLES: Record<StepStatus, { badge: string; marker: string }> = {
  complete: { badge: 'text-primary', marker: 'border-primary bg-primary text-primary-foreground' },
  current: { badge: 'text-foreground font-medium', marker: 'border-primary text-primary' },
  todo: { badge: 'text-muted-foreground', marker: 'border-border text-muted-foreground' },
  waiting: { badge: 'text-muted-foreground', marker: 'border-border text-muted-foreground' },
  blocked: { badge: 'text-destructive', marker: 'border-destructive text-destructive' },
};

export interface BusinessSetupChecklistProps {
  steps: SetupStep[];
  /** Render as a slim header strip rather than the full dashboard card. */
  compact?: boolean;
  /** Which step the current page represents, so it can be marked "you are here". */
  activeStepId?: SetupStep['id'];
}

export function BusinessSetupChecklist({ steps, compact = false, activeStepId }: BusinessSetupChecklistProps) {
  const doneCount = steps.filter((s) => s.status === 'complete').length;
  const next = steps.find((s) => s.status === 'current');
  // With no actionable step left, the provider is either finished or waiting on
  // us. Saying "nothing to do" in the second case reads as a dead end, so name
  // what is actually happening.
  const waiting = steps.find((s) => s.status === 'waiting');
  const blockedStep = steps.find((s) => s.status === 'blocked');
  const headline =
    doneCount === steps.length
      ? 'Everything is done — your listings are live for families.'
      : next
        ? `Next up: ${next.title.toLowerCase()}.`
        : blockedStep
          ? `${blockedStep.title}: ${blockedStep.statusLabel.toLowerCase()}.`
          : waiting
            ? 'Your side is done — we are reviewing your application now.'
            : 'Nothing to do right now.';

  if (compact) {
    return (
      <div className="mb-6 rounded-lg border bg-card p-3">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
          {steps.map((step, i) => {
            const Icon = STATUS_ICON[step.status];
            const styles = STATUS_STYLES[step.status];
            const isHere = step.id === activeStepId;
            return (
              <li key={step.id} className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${styles.marker}`}
                  aria-hidden="true"
                >
                  {step.status === 'complete' ? <Icon className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={isHere ? 'font-semibold text-foreground' : styles.badge}>
                  {step.title}
                  {isHere && <span className="sr-only"> (current page)</span>}
                </span>
                {i < steps.length - 1 && <span className="text-muted-foreground/50" aria-hidden="true">→</span>}
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <section aria-labelledby="setup-heading" className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:p-5">
        <div>
          <h2 id="setup-heading" className="text-lg font-semibold">
            Getting set up
          </h2>
          <p className="text-sm text-muted-foreground">{headline}</p>
        </div>
        <span className="text-sm text-muted-foreground">
          {doneCount} of {steps.length} complete
        </span>
      </div>

      <ol className="divide-y">
        {steps.map((step, i) => {
          const Icon = STATUS_ICON[step.status];
          const styles = STATUS_STYLES[step.status];
          const isCurrent = step.status === 'current';
          return (
            <li
              key={step.id}
              className={`flex flex-wrap items-start gap-3 p-4 sm:gap-4 sm:p-5 ${isCurrent ? 'bg-primary/5' : ''}`}
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${styles.marker}`}
                aria-hidden="true"
              >
                {step.status === 'complete' ? <Icon className="h-4 w-4" /> : i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 className="font-medium">{step.title}</h3>
                  <span className={`text-xs ${styles.badge}`}>· {step.statusLabel}</span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>
              </div>

              {step.actionable && (
                <Button
                  asChild
                  size="sm"
                  variant={isCurrent ? 'default' : 'outline'}
                  className="min-h-[40px] shrink-0"
                >
                  <Link href={step.href}>
                    {step.ctaLabel}
                    {isCurrent && <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />}
                  </Link>
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
