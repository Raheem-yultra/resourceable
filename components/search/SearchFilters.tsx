'use client';

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MapPin, Check, Plus, Minus, SlidersHorizontal } from 'lucide-react';

interface Disability {
  id: string;
  name: string;
  slug?: string;
}

interface ServiceType {
  id: string;
  name: string;
  slug?: string;
}

export interface AppliedFilters {
  zipCode: string;
  radius: number;
  disabilities: Disability[];
  serviceTypes: ServiceType[];
  priceMin?: number;
  priceMax?: number;
}

interface SearchFiltersProps {
  onSearch: (filters: AppliedFilters) => void;
  /** Currently applied filters, so reopening the panel shows what's in effect. */
  initial?: Partial<AppliedFilters>;
  /** Sort is applied live (not on "Show results"), so it's owned by the parent. */
  sortBy?: string;
  onSortChange?: (value: string) => void;
}

const PRICE_RANGES = [
  { min: 0, max: 50, label: 'Under $50' },
  { min: 50, max: 100, label: '$50 – $100' },
  { min: 100, max: 200, label: '$100 – $200' },
  { min: 200, max: 500, label: '$200 – $500' },
  { min: 500, max: 999999, label: '$500+' },
];

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Recommended' },
  { value: 'price', label: 'Lowest price' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'newest', label: 'Newest' },
];

/** How many chips to show before the "+N more" toggle. */
const CHIP_PREVIEW = 8;

export function SearchFilters({ onSearch, initial, sortBy, onSortChange }: SearchFiltersProps) {
  const [disabilities, setDisabilities] = useState<Disability[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Seed from the applied filters: the panel lives in a sheet that unmounts on
  // close, so without this every reopen would silently reset the user's choices.
  const [zipCode, setZipCode] = useState(initial?.zipCode ?? '');
  const [radius, setRadius] = useState(initial?.radius ?? 25);
  const [selectedDisabilities, setSelectedDisabilities] = useState<Disability[]>(
    initial?.disabilities ?? []
  );
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<ServiceType[]>(
    initial?.serviceTypes ?? []
  );
  const [priceRange, setPriceRange] = useState<{ min: number; max: number } | null>(
    initial?.priceMin !== undefined && initial?.priceMax !== undefined
      ? { min: initial.priceMin, max: initial.priceMax }
      : null
  );
  const [showAllDisabilities, setShowAllDisabilities] = useState(false);
  const [showAllServices, setShowAllServices] = useState(false);

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [disabilitiesRes, serviceTypesRes] = await Promise.all([
          fetch('/api/disabilities'),
          fetch('/api/service-types'),
        ]);
        if (disabilitiesRes.ok) {
          const data = await disabilitiesRes.json();
          setDisabilities(data.disabilities || []);
        }
        if (serviceTypesRes.ok) {
          const data = await serviceTypesRes.json();
          setServiceTypes(data.serviceTypes || []);
        }
      } catch (error) {
        console.error('Failed to fetch filter options:', error);
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchFilters();
  }, []);

  const toggleDisability = (disability: Disability) =>
    setSelectedDisabilities((prev) =>
      prev.some((d) => d.id === disability.id)
        ? prev.filter((d) => d.id !== disability.id)
        : [...prev, disability]
    );

  const toggleServiceType = (serviceType: ServiceType) =>
    setSelectedServiceTypes((prev) =>
      prev.some((s) => s.id === serviceType.id)
        ? prev.filter((s) => s.id !== serviceType.id)
        : [...prev, serviceType]
    );

  const activeCount = useMemo(
    () =>
      selectedDisabilities.length +
      selectedServiceTypes.length +
      (priceRange ? 1 : 0) +
      (zipCode ? 1 : 0),
    [selectedDisabilities, selectedServiceTypes, priceRange, zipCode]
  );

  const handleApplyFilters = () => {
    onSearch({
      zipCode,
      radius,
      disabilities: selectedDisabilities,
      serviceTypes: selectedServiceTypes,
      priceMin: priceRange?.min,
      priceMax: priceRange?.max,
    });
  };

  const handleClearAll = () => {
    setZipCode('');
    setRadius(25);
    setSelectedDisabilities([]);
    setSelectedServiceTypes([]);
    setPriceRange(null);
    onSearch({ zipCode: '', radius: 25, disabilities: [], serviceTypes: [] });
  };

  const visibleDisabilities = showAllDisabilities
    ? disabilities
    : disabilities.slice(0, CHIP_PREVIEW);
  const visibleServiceTypes = showAllServices
    ? serviceTypes
    : serviceTypes.slice(0, CHIP_PREVIEW);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
        {/* Sort — applies immediately, so it sits first and reads as a view switch
            rather than something you have to "apply". */}
        {sortBy !== undefined && onSortChange && (
          <FilterSection title="Sort by" icon={<SlidersHorizontal className="h-4 w-4" />} first>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Sort listings by">
              {SORT_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  role="radio"
                  selected={sortBy === option.value}
                  onClick={() => onSortChange(option.value)}
                >
                  {option.label}
                </Chip>
              ))}
            </div>
          </FilterSection>
        )}

        <FilterSection
          title="Location"
          icon={<MapPin className="h-4 w-4" />}
          count={zipCode ? 1 : 0}
          onClear={zipCode ? () => setZipCode('') : undefined}
          first={sortBy === undefined}
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
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value.replace(/\D/g, ''))}
              className="h-11 pl-9"
              aria-describedby="zip-code-hint"
            />
          </div>

          {/* The radius only means something once there's a ZIP to measure from,
              so it stays disabled (and explains itself) until one is entered. */}
          <div className={cn('mt-4 transition-opacity', !zipCode && 'opacity-50')}>
            <div className="mb-2 flex items-baseline justify-between">
              <label htmlFor="radius-slider" className="text-sm text-muted-foreground">
                Within
              </label>
              <span className="text-sm font-semibold tabular-nums">{radius} miles</span>
            </div>
            <input
              id="radius-slider"
              type="range"
              min="5"
              max="100"
              step="5"
              value={radius}
              disabled={!zipCode}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary disabled:cursor-not-allowed"
              aria-label={`Search radius: ${radius} miles`}
            />
            <p id="zip-code-hint" className="mt-2 text-xs text-muted-foreground">
              {zipCode ? 'Drag to widen or narrow the search area.' : 'Enter a ZIP code to search by distance.'}
            </p>
          </div>
        </FilterSection>

        <FilterSection
          title="Disability"
          count={selectedDisabilities.length}
          onClear={selectedDisabilities.length ? () => setSelectedDisabilities([]) : undefined}
        >
          <ChipGroup
            label="Filter by disability"
            loading={loadingOptions}
            empty={!loadingOptions && disabilities.length === 0}
          >
            {visibleDisabilities.map((disability) => (
              <Chip
                key={disability.id}
                selected={selectedDisabilities.some((d) => d.id === disability.id)}
                onClick={() => toggleDisability(disability)}
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
          count={selectedServiceTypes.length}
          onClear={selectedServiceTypes.length ? () => setSelectedServiceTypes([]) : undefined}
        >
          <ChipGroup
            label="Filter by service type"
            loading={loadingOptions}
            empty={!loadingOptions && serviceTypes.length === 0}
          >
            {visibleServiceTypes.map((serviceType) => (
              <Chip
                key={serviceType.id}
                selected={selectedServiceTypes.some((s) => s.id === serviceType.id)}
                onClick={() => toggleServiceType(serviceType)}
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

        <FilterSection
          title="Price"
          count={priceRange ? 1 : 0}
          onClear={priceRange ? () => setPriceRange(null) : undefined}
        >
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Price range">
            {PRICE_RANGES.map((range) => {
              const selected = priceRange?.min === range.min && priceRange?.max === range.max;
              return (
                <Chip
                  key={range.label}
                  role="radio"
                  selected={selected}
                  // Re-clicking the active range clears it — no separate "Any price" option to hunt for.
                  onClick={() => setPriceRange(selected ? null : { min: range.min, max: range.max })}
                >
                  {range.label}
                </Chip>
              );
            })}
          </div>
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
        <Button onClick={handleApplyFilters} className="flex-1 font-semibold">
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
