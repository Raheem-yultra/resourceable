'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MapPin, Check, Plus, Minus, Users, ShieldCheck } from 'lucide-react';
import { AGE_GROUP_FILTERS } from '@/lib/listing-taxonomy';
import { DEFAULT_RADIUS, type SearchState } from '@/lib/search-url';

export interface FilterOption {
  id: string;
  name: string;
  slug?: string;
}

interface SearchFiltersProps {
  /** Applied filters, so reopening the panel shows what's actually in effect. */
  initial: SearchState;
  /** Loaded once by the parent — the pills outside this panel need the names too. */
  disabilities: FilterOption[];
  serviceTypes: FilterOption[];
  loadingOptions: boolean;
  /** Suppress the age section on categories that already pin an age (21+). */
  hideAgeFilter?: boolean;
  onApply: (next: SearchState) => void;
}

/** How many chips to show before the "+N more" toggle. */
const CHIP_PREVIEW = 8;

export function SearchFilters({
  initial,
  disabilities,
  serviceTypes,
  loadingOptions,
  hideAgeFilter = false,
  onApply,
}: SearchFiltersProps) {
  // Seed from the applied filters: the panel lives in a sheet that unmounts on
  // close, so without this every reopen would silently reset the user's choices.
  const [draft, setDraft] = useState<SearchState>(initial);
  const [showAllDisabilities, setShowAllDisabilities] = useState(false);
  const [showAllServices, setShowAllServices] = useState(false);

  const patch = (changes: Partial<SearchState>) => setDraft((d) => ({ ...d, ...changes }));

  const toggleIn = (key: 'disabilityIds' | 'serviceTypeIds' | 'ageGroups', value: string) =>
    setDraft((d) => ({
      ...d,
      [key]: d[key].includes(value) ? d[key].filter((v) => v !== value) : [...d[key], value],
    }));

  const activeCount = useMemo(
    () =>
      draft.disabilityIds.length +
      draft.serviceTypeIds.length +
      draft.ageGroups.length +
      (draft.zipCode ? 1 : 0) +
      (draft.verifiedOnly ? 1 : 0) +
      (draft.insuranceAccepted ? 1 : 0),
    [draft]
  );

  const handleClearAll = () => {
    const cleared: SearchState = {
      ...draft,
      zipCode: '',
      radius: DEFAULT_RADIUS,
      disabilityIds: [],
      serviceTypeIds: [],
      ageGroups: [],
      verifiedOnly: false,
      insuranceAccepted: false,
      // Sorting by distance with no ZIP has nothing to measure from.
      sortBy: draft.sortBy === 'distance' ? 'relevance' : draft.sortBy,
    };
    setDraft(cleared);
    onApply(cleared);
  };

  const visibleDisabilities = showAllDisabilities ? disabilities : disabilities.slice(0, CHIP_PREVIEW);
  const visibleServiceTypes = showAllServices ? serviceTypes : serviceTypes.slice(0, CHIP_PREVIEW);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
        <FilterSection
          title="Location"
          icon={<MapPin className="h-4 w-4" />}
          count={draft.zipCode ? 1 : 0}
          onClear={draft.zipCode ? () => patch({ zipCode: '' }) : undefined}
          first
        >
          <label htmlFor="zip-code-input" className="sr-only">
            ZIP code
          </label>
          <div className="relative">
            <MapPin
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="zip-code-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{5}"
              maxLength={5}
              placeholder="ZIP code"
              value={draft.zipCode}
              onChange={(e) => patch({ zipCode: e.target.value.replace(/\D/g, '') })}
              className="h-11 pl-9"
              aria-describedby="zip-code-hint"
            />
          </div>

          {/* The radius only means something once there's a ZIP to measure from,
              so it stays disabled (and explains itself) until one is entered. */}
          <div className={cn('mt-4 transition-opacity', !draft.zipCode && 'opacity-50')}>
            <div className="mb-2 flex items-baseline justify-between">
              <label htmlFor="radius-slider" className="text-sm text-muted-foreground">
                Within
              </label>
              <span className="text-sm font-semibold tabular-nums">{draft.radius} miles</span>
            </div>
            <input
              id="radius-slider"
              type="range"
              min="5"
              max="100"
              step="5"
              value={draft.radius}
              disabled={!draft.zipCode}
              onChange={(e) => patch({ radius: Number(e.target.value) })}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary disabled:cursor-not-allowed"
              aria-label={`Search radius: ${draft.radius} miles`}
            />
            <p id="zip-code-hint" className="mt-2 text-xs text-muted-foreground">
              {draft.zipCode
                ? 'Drag to widen or narrow the search area.'
                : 'Enter a ZIP code to search by distance.'}
            </p>
          </div>
        </FilterSection>

        {/* Age sits directly under Location because those are the two questions a
            family answers first: who is it for, and is it near me. */}
        {!hideAgeFilter && (
          <FilterSection
            title="Age"
            icon={<Users className="h-4 w-4" />}
            count={draft.ageGroups.length}
            onClear={draft.ageGroups.length ? () => patch({ ageGroups: [] }) : undefined}
          >
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by age">
              {AGE_GROUP_FILTERS.map((age) => (
                <Chip
                  key={age.value}
                  selected={draft.ageGroups.includes(age.value)}
                  onClick={() => toggleIn('ageGroups', age.value)}
                >
                  {age.label}
                </Chip>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Listings marked “all ages” are always included.
            </p>
          </FilterSection>
        )}

        {/* Trust and cost — the API has always supported both; neither was reachable
            from the UI, which for this audience are two of the three questions that
            decide whether a provider is worth calling at all. */}
        <FilterSection
          title="Trust & cost"
          icon={<ShieldCheck className="h-4 w-4" />}
          count={(draft.verifiedOnly ? 1 : 0) + (draft.insuranceAccepted ? 1 : 0)}
          onClear={
            draft.verifiedOnly || draft.insuranceAccepted
              ? () => patch({ verifiedOnly: false, insuranceAccepted: false })
              : undefined
          }
        >
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by trust and cost">
            <Chip selected={draft.verifiedOnly} onClick={() => patch({ verifiedOnly: !draft.verifiedOnly })}>
              Verified providers only
            </Chip>
            <Chip
              selected={draft.insuranceAccepted}
              onClick={() => patch({ insuranceAccepted: !draft.insuranceAccepted })}
            >
              Accepts insurance
            </Chip>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Verified means we have checked the provider&apos;s credentials against public registries.
          </p>
        </FilterSection>

        <FilterSection
          title="Disability"
          count={draft.disabilityIds.length}
          onClear={draft.disabilityIds.length ? () => patch({ disabilityIds: [] }) : undefined}
        >
          <ChipGroup
            label="Filter by disability"
            loading={loadingOptions}
            empty={!loadingOptions && disabilities.length === 0}
          >
            {visibleDisabilities.map((disability) => (
              <Chip
                key={disability.id}
                selected={draft.disabilityIds.includes(disability.id)}
                onClick={() => toggleIn('disabilityIds', disability.id)}
              >
                {disability.name}
              </Chip>
            ))}
            {disabilities.length > CHIP_PREVIEW && (
              <MoreChip
                expanded={showAllDisabilities}
                hidden={disabilities.length - CHIP_PREVIEW}
                onClick={() => setShowAllDisabilities((v) => !v)}
              />
            )}
          </ChipGroup>
        </FilterSection>

        <FilterSection
          title="Service type"
          count={draft.serviceTypeIds.length}
          onClear={draft.serviceTypeIds.length ? () => patch({ serviceTypeIds: [] }) : undefined}
        >
          <ChipGroup
            label="Filter by service type"
            loading={loadingOptions}
            empty={!loadingOptions && serviceTypes.length === 0}
          >
            {visibleServiceTypes.map((serviceType) => (
              <Chip
                key={serviceType.id}
                selected={draft.serviceTypeIds.includes(serviceType.id)}
                onClick={() => toggleIn('serviceTypeIds', serviceType.id)}
              >
                {serviceType.name}
              </Chip>
            ))}
            {serviceTypes.length > CHIP_PREVIEW && (
              <MoreChip
                expanded={showAllServices}
                hidden={serviceTypes.length - CHIP_PREVIEW}
                onClick={() => setShowAllServices((v) => !v)}
              />
            )}
          </ChipGroup>
        </FilterSection>
      </div>

      {/* Always-reachable actions: the list above scrolls, this bar doesn't. */}
      <div className="flex items-center gap-3 border-t border-border/70 bg-background px-5 py-4">
        <Button
          variant="ghost"
          onClick={handleClearAll}
          disabled={activeCount === 0}
          className="text-muted-foreground hover:text-foreground"
        >
          Clear all
        </Button>
        <Button onClick={() => onApply(draft)} className="flex-1 font-semibold">
          Show results
          {activeCount > 0 && (
            <span className="ml-1.5 rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs font-bold tabular-nums">
              {activeCount}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * One filter group. Sections are separated by hairlines instead of nested cards —
 * a panel of stacked bordered boxes reads as four unrelated widgets.
 */
function FilterSection({
  title,
  icon,
  count = 0,
  onClear,
  first = false,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  count?: number;
  onClear?: () => void;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('py-5', !first && 'border-t border-border/60')}>
      <div className="mb-3 flex items-center gap-2">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <h3 className="text-sm font-semibold">{title}</h3>
        {count > 0 && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums">
            {count}
          </span>
        )}
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto rounded text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function ChipGroup({
  label,
  loading,
  empty,
  children,
}: {
  label: string;
  loading: boolean;
  empty: boolean;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex flex-wrap gap-2" aria-busy="true" aria-label={`${label}, loading`}>
        {[68, 92, 76, 110, 84].map((w, i) => (
          <div key={i} className="h-9 animate-pulse rounded-full bg-secondary" style={{ width: w }} />
        ))}
      </div>
    );
  }
  if (empty) {
    return <p className="text-sm text-muted-foreground">No options available right now.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {children}
    </div>
  );
}

/**
 * Selectable chip. Replaces the old checkbox column: options are scannable at a
 * glance, the whole target is tappable, and what's on is visible without reading
 * every row.
 */
function Chip({
  selected,
  onClick,
  role = 'checkbox',
  children,
}: {
  selected: boolean;
  onClick: () => void;
  role?: 'checkbox' | 'radio';
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        selected
          ? 'border-primary bg-primary/10 font-medium text-primary'
          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
      )}
    >
      {selected && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
}

function MoreChip({
  expanded,
  hidden,
  onClick,
}: {
  expanded: boolean;
  hidden: number;
  onClick: () => void;
}) {
  const Icon = expanded ? Minus : Plus;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className="inline-flex min-h-[36px] items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {expanded ? 'Show less' : `${hidden} more`}
    </button>
  );
}
