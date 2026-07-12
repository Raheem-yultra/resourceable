import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Consistent empty/no-results state used across data-fetching views so we don't
 * repeat near-duplicate one-off "nothing here" blocks. Always give context, never
 * a blank screen.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center rounded-lg border border-dashed bg-card/50 px-6 py-12 text-center', className)}
      role="status"
    >
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold sm:text-lg">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
