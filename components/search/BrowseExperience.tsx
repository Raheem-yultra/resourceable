'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search, X, Filter, BookOpen, ExternalLink, Loader2, MapPin, Info,
  LayoutGrid, Stethoscope, HeartHandshake, ShoppingBag, GraduationCap, CalendarDays, UserRound,
} from 'lucide-react';
import { SearchFilters, type FilterOption } from '@/components/search/SearchFilters';
import { ServiceList } from '@/components/search/ServiceList';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { LiabilityDisclaimer } from '@/components/listing/LiabilityDisclaimer';
import { BROWSE_CATEGORIES, ageGroupMeta, type BrowseCategory } from '@/lib/listing-taxonomy';
import {
  parseSearchState,
  serializeSearchState,
  toApiParams,
  countActiveFilters,
  EMPTY_SEARCH_STATE,
  type SearchState,
  type SortOption,
} from '@/lib/search-url';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';

const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Stethoscope, HeartHandshake, ShoppingBag, GraduationCap, CalendarDays, UserRound,
};

/** Server page size. The list appends a page at a time rather than replacing. */
const PAGE_SIZE = 20;

const SORT_OPTIONS: Array<{ value: SortOption; label: string; needsZip?: boolean }> = [
  { value: 'relevance', label: 'Recommended' },
  { value: 'distance', label: 'Nearest', needsZip: true },
  { value: 'rating', label: 'Highest rated' },
  { value: 'newest', label: 'Newest' },
];

interface ResourceCard {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  topicTags: string[];
  externalUrl: string | null;
}

interface LocationContext {
  zipCode: string | null;
  radiusMiles: number | null;
  resolved: boolean;
  sortedByDistance: boolean;
}

export interface BrowseExperienceProps {
  /** Pre-select a browse category. Omit for the unified "All" view. */
  initialCategory?: BrowseCategory;
  /** Page heading. */
  title?: string;
  /** Short intro line under the heading. */
  subtitle?: string;
}

/**
 * The one place you look for anything on ResourceAble (plan §5–§7).
 *
 * Powers /browse and every /browse/<type> route. There used to be a second entry
 * point at /search rendering this same component over the same index with the
 * same filters — two URLs, one screen. That is now a permanent redirect here, so
 * this really is the only search surface and there is no longer a wrong answer to
 * "which one do I link to?".
 *
 * A listing-type tab bar switches between "All" and a single type; the keyword
 * and every filter persist across tab switches (only the type changes), matching
 * plan §7.2's "filter state loss" guardrail. The selected type is a path segment,
 * which is what makes /browse/therapies an indexable page in its own right rather
 * than a view state nobody can link to.
 *
 * Every part of that state also lives in the URL (see lib/search-url), which is
 * what makes a search shareable, bookmarkable, and survivable across a Back press
 * from a listing page.
 */
export function BrowseExperience(props: BrowseExperienceProps) {
  // useSearchParams needs its own boundary, and this component is the only thing
  // on these routes — without it the whole page would opt into client rendering.
  return (
    <Suspense fallback={<BrowseSkeleton title={props.title} subtitle={props.subtitle} />}>
      <BrowseExperienceInner {...props} />
    </Suspense>
  );
}

function BrowseSkeleton({ title, subtitle }: { title?: string; subtitle?: string }) {
  return (
    <div className="min-h-screen">
      <div className="page-wrap">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2">{title}</h1>
        {subtitle && <p className="text-sm sm:text-base text-muted-foreground mb-4">{subtitle}</p>}
        <div className="py-12 text-center" role="status">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4" aria-hidden="true" />
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      </div>
    </div>
  );
}

function BrowseExperienceInner({
  initialCategory,
  title = 'Find services and support',
  subtitle,
}: BrowseExperienceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const urlParams = useSearchParams();

  // The URL is the source of truth for a search, so the first render already
  // reflects a shared link instead of flashing unfiltered results and correcting
  // itself. `useState(fn)` runs the parse once, on mount.
  const [state, setState] = useState<SearchState>(() =>
    parseSearchState(new URLSearchParams(urlParams.toString()))
  );
  // The text box is edited far more often than it is submitted, so it holds its
  // own draft. `state.query` only changes when a search is actually run — that is
  // what keeps the URL and the results in agreement.
  const [queryDraft, setQueryDraft] = useState(state.query);

  // The route decides the category — /browse is "All", /browse/<slug> is one type.
  const [category, setCategory] = useState<BrowseCategory | undefined>(initialCategory);

  const [services, setServices] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [location, setLocation] = useState<LocationContext | null>(null);

  // Start in the loading state: the initial fetch fires on mount, so showing the
  // spinner immediately avoids a flash of the "No listings found" empty state.
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  // A sort the user asked for that cannot run yet. "Nearest" needs a ZIP, so
  // choosing it opens the filter panel — and this remembers *why*, so that once
  // they type a ZIP the sort they originally asked for is what they get.
  const [pendingSort, setPendingSort] = useState<SortOption | null>(null);

  // Monotonic request id: only the most recent search may update state, so a slow
  // earlier request can't clobber a newer one or leave the spinner stuck.
  const reqIdRef = useRef(0);

  // Filter options live here rather than inside the panel: the panel unmounts when
  // the sheet closes, and the active-filter pills outside it need names for the
  // ids held in state. Loading them once, at this level, serves both.
  const [disabilityOptions, setDisabilityOptions] = useState<FilterOption[]>([]);
  const [serviceTypeOptions, setServiceTypeOptions] = useState<FilterOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);

  // Resources live in a different table from listings, so the combined
  // "Events & Resources" category loads them alongside rather than through search.
  const [resources, setResources] = useState<ResourceCard[]>([]);

  const announce = (text: string) => {
    const el = document.getElementById('search-announcement');
    if (el) el.textContent = text;
  };

  /**
   * Run a search.
   *
   * `append` is the difference between "Load more" and everything else: it keeps
   * the rows already on screen and adds the next page beneath them, so the reader
   * never loses their place in a list they were halfway down.
   */
  const runSearch = useCallback(
    async (
      next: SearchState,
      cat: BrowseCategory | undefined,
      opts: { page?: number; append?: boolean } = {}
    ) => {
      const targetPage = opts.page ?? 1;
      const append = opts.append ?? false;
      const reqId = ++reqIdRef.current;
      const isCurrent = () => reqId === reqIdRef.current;

      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
        announce('Searching for listings…');
      }

      // Never let a hung request spin forever: abort after 15s so the user gets a
      // retryable error instead of a frozen spinner.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      try {
        const params = toApiParams(next, {
          listingType: cat?.listingType,
          ageGroup: cat?.ageGroup,
          page: targetPage,
          limit: PAGE_SIZE,
        });
        const response = await fetch(`/api/search?${params.toString()}`, { signal: controller.signal });
        if (!isCurrent()) return; // a newer search superseded this one

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const message = errorData.error || 'Failed to load listings. Please try again.';
          setError(message);
          if (!append) {
            setServices([]);
            setTotalResults(0);
            setHasMore(false);
          }
          announce(`Error: ${message}`);
          return;
        }

        const data = await response.json();
        const incoming = data.services || [];
        setServices((prev) => (append ? [...prev, ...incoming] : incoming));
        setTotalResults(data.pagination?.total ?? incoming.length);
        setHasMore(!!data.pagination?.hasMore);
        setLocation(data.location ?? null);
        setPage(targetPage);

        const total = data.pagination?.total ?? incoming.length;
        announce(
          append
            ? `Loaded ${incoming.length} more listings.`
            : `Found ${total} listing${total !== 1 ? 's' : ''}`
        );
      } catch (err: any) {
        // Ignore aborts caused by a newer search taking over — that request owns the UI.
        if (!isCurrent()) return;
        const message =
          err?.name === 'AbortError'
            ? 'This search took too long. Please try again.'
            : 'Unable to connect to the server. Please check your connection and try again.';
        console.error('Search failed:', err);
        setError(message);
        if (!append) {
          setServices([]);
          setTotalResults(0);
          setHasMore(false);
        }
        announce(message);
      } finally {
        clearTimeout(timeout);
        if (isCurrent()) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    []
  );

  /** Push the current state into the address bar without adding a history entry per keystroke. */
  const syncUrl = useCallback(
    (next: SearchState, cat: BrowseCategory | undefined) => {
      const params = serializeSearchState(next);
      const target = cat ? `/browse/${cat.slug}` : '/browse';
      const qs = params.toString();
      router.replace(qs ? `${target}?${qs}` : target, { scroll: false });
    },
    [router]
  );

  /** The one path every user-initiated search takes: update state, URL, and results together. */
  const apply = useCallback(
    (next: SearchState, cat: BrowseCategory | undefined = category) => {
      setState(next);
      setCategory(cat);
      syncUrl(next, cat);
      void runSearch(next, cat, { page: 1 });
    },
    [category, runSearch, syncUrl]
  );

  /**
   * Switching the listing-type tab.
   *
   * The category is a path segment, so changing it is a real navigation — the
   * component unmounts and the destination route's own mount fetch runs.
   * Searching here as well would issue the identical request twice and show the
   * first result set for the instant before the remount threw it away, so this
   * only navigates and lets the destination do the fetching. Re-selecting the tab
   * you are already on is not a navigation, so that case searches in place.
   */
  const selectCategory = useCallback(
    (cat: BrowseCategory | undefined) => {
      if (cat?.slug === category?.slug) {
        apply({ ...state, query: queryDraft }, cat);
        return;
      }
      const params = serializeSearchState({ ...state, query: queryDraft });
      const qs = params.toString();
      const target = cat ? `/browse/${cat.slug}` : '/browse';
      router.push(qs ? `${target}?${qs}` : target);
    },
    [apply, category, queryDraft, router, state]
  );

  const loadMore = useCallback(() => {
    void runSearch(state, category, { page: page + 1, append: true });
  }, [runSearch, state, category, page]);

  // Initial load only. `loading` already starts true and `error` starts null, so
  // this needs no state write of its own — later searches are driven by their own
  // handlers rather than routed back through an effect.
  useEffect(() => {
    // set-state-in-effect is a false positive here: every state write inside
    // runSearch happens after `await fetch(...)`, but the rule cannot see through
    // the async useCallback and assumes they are reachable synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runSearch(state, category, { page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter options, once per visit.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/disabilities').then((r) => (r.ok ? r.json() : { disabilities: [] })),
      fetch('/api/service-types').then((r) => (r.ok ? r.json() : { serviceTypes: [] })),
    ])
      .then(([d, s]) => {
        if (cancelled) return;
        setDisabilityOptions(d.disabilities || []);
        setServiceTypeOptions(s.serviceTypes || []);
      })
      .catch(() => {
        // Non-fatal: search still works, the chip lists just stay empty.
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the knowledge base only for categories that surface it, and only once
  // per visit — resources are editorial and don't change between searches.
  useEffect(() => {
    if (!category?.includesResources || resources.length > 0) return;
    let cancelled = false;
    fetch('/api/resources?limit=6')
      .then((r) => (r.ok ? r.json() : { resources: [] }))
      .then((d) => {
        if (!cancelled) setResources(d.resources || []);
      })
      .catch(() => {
        // Non-fatal: the listings half of the category still works without it.
      });
    return () => {
      cancelled = true;
    };
  }, [category, resources.length]);

  // Names for the ids held in state, so the active-filter pills can label
  // themselves without the panel being mounted.
  const nameFor = useMemo(() => {
    const map = new Map<string, string>();
    disabilityOptions.forEach((o) => map.set(o.id, o.name));
    serviceTypeOptions.forEach((o) => map.set(o.id, o.name));
    return map;
  }, [disabilityOptions, serviceTypeOptions]);

  const activeCount = countActiveFilters(state);
  const submitSearch = () => apply({ ...state, query: queryDraft });

  const clearAllFilters = () => {
    setQueryDraft('');
    apply({ ...EMPTY_SEARCH_STATE, sortBy: state.sortBy });
  };

  const removeFilter = (key: 'disabilityIds' | 'serviceTypeIds' | 'ageGroups', value: string) =>
    apply({ ...state, [key]: state[key].filter((v) => v !== value) });

  // "Nearest" is only meaningful with somewhere to measure from. Rather than
  // disabling it — which leaves the user guessing why — choosing it with no ZIP
  // opens the panel where the ZIP box is, carrying the request with it.
  const chooseSort = (value: SortOption) => {
    if (value === 'distance' && !state.zipCode) {
      setPendingSort('distance');
      setShowFilters(true);
      return;
    }
    setPendingSort(null);
    apply({ ...state, sortBy: value });
  };

  return (
    <div className="min-h-screen">
      <div id="search-announcement" role="status" aria-live="polite" aria-atomic="true" className="sr-only" />

      <div className="page-wrap">
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2">{title}</h1>
          {subtitle && <p className="text-sm sm:text-base text-muted-foreground mb-4">{subtitle}</p>}

          {/* Listing-type tabs (plan §5/§7.1) */}
          <div className="mb-4 overflow-x-auto -mx-1 px-1" role="tablist" aria-label="Listing types">
            <div className="flex gap-2 min-w-max pb-1">
              <TabButton
                active={!category}
                icon={<LayoutGrid className="h-4 w-4" aria-hidden="true" />}
                label="All"
                onClick={() => selectCategory(undefined)}
              />
              {BROWSE_CATEGORIES.map((c) => {
                const Icon = TAB_ICONS[c.icon] || LayoutGrid;
                return (
                  <TabButton
                    key={c.slug}
                    active={category?.slug === c.slug}
                    icon={<Icon className="h-4 w-4" aria-hidden="true" />}
                    label={c.label}
                    onClick={() => selectCategory(c)}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="relative flex-1">
              <label htmlFor="search-input" className="sr-only">Search for listings</label>
              <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground pointer-events-none" aria-hidden="true" />
              <Input
                id="search-input"
                type="search"
                placeholder="Search... (e.g., speech therapy, wheelchair, support group)"
                className="h-11 sm:h-12 pl-10 sm:pl-12 pr-4 text-sm sm:text-base"
                value={queryDraft}
                onChange={(e) => setQueryDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(); }}
              />
            </div>

            <div className="flex gap-2 sm:gap-3">
              <Sheet open={showFilters} onOpenChange={setShowFilters}>
                <SheetTrigger asChild>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-11 sm:h-12 gap-2 shadow-sm transition-all flex-1 sm:flex-none sm:px-6"
                    aria-label={`Filters${activeCount > 0 ? `, ${activeCount} active` : ''}`}
                  >
                    <Filter className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                    <span className="font-semibold text-sm sm:text-base">Filters</span>
                    {activeCount > 0 && (
                      <span className="ml-1 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs font-bold" aria-hidden="true">
                        {activeCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
                  <SheetHeader className="border-b border-border/70 px-5 py-4 pr-12">
                    <SheetTitle>Filters</SheetTitle>
                    <SheetDescription>Refine your search to find the right fit</SheetDescription>
                  </SheetHeader>
                  <SearchFilters
                    // Seeded with the deferred sort, if there is one, so the panel
                    // hands it back once the ZIP that makes it possible is filled in.
                    initial={pendingSort ? { ...state, sortBy: pendingSort } : state}
                    disabilities={disabilityOptions}
                    serviceTypes={serviceTypeOptions}
                    loadingOptions={optionsLoading}
                    // On a category that already pins an age (21+), an age filter
                    // would only contradict it — so it isn't offered.
                    hideAgeFilter={!!category?.ageGroup}
                    onApply={(next) => {
                      setPendingSort(null);
                      apply({ ...next, query: queryDraft });
                      setShowFilters(false);
                    }}
                  />
                </SheetContent>
              </Sheet>

              <Button
                size="lg"
                className="h-11 sm:h-12 px-4 sm:px-8 flex-1 sm:flex-none text-sm sm:text-base"
                onClick={submitSearch}
              >
                Search
              </Button>
            </div>

            {/* Sort is a view switch, not something you "apply" — it belongs beside
                the results it reorders, not three taps deep inside a panel. */}
            <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Sort listings by">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sort</span>
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={(pendingSort ?? state.sortBy) === option.value}
                  onClick={() => chooseSort(option.value)}
                  className={cn(
                    'inline-flex min-h-[32px] items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    (pendingSort ?? state.sortBy) === option.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40'
                  )}
                >
                  {option.needsZip && <MapPin className="h-3 w-3" aria-hidden="true" />}
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <section id="search-results" tabIndex={-1}>
          {/* A ZIP we hold no coordinates for cannot be measured from. Saying so is
              the difference between "nothing near you" and "we don't know where
              that is yet" — one of those makes the family stop looking. */}
          {location?.zipCode && !location.resolved && (
            <div className="theme-note mb-4 flex items-start gap-3 p-4" role="status">
              <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <p className="text-sm">
                We don&apos;t have any mapped providers in {location.zipCode} yet, so we couldn&apos;t search by
                distance. These results match the ZIP code itself — try a nearby ZIP, or clear it to see everything.
              </p>
            </div>
          )}

          {(services.length > 0 || activeCount > 0) && (
            <div className="mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-3 sm:mb-4">
                <span className="text-primary">{totalResults} listing{totalResults !== 1 ? 's' : ''}</span>
                {state.query && <span className="hidden sm:inline"> matching &quot;{state.query}&quot;</span>}
                {location?.resolved && location.radiusMiles && (
                  <span className="text-base font-normal text-muted-foreground">
                    {' '}within {location.radiusMiles} miles of {location.zipCode}
                  </span>
                )}
              </h2>

              {activeCount > 0 && (
                <div className="flex flex-wrap gap-2 mb-3 sm:mb-4" role="group" aria-label="Active filters">
                  {state.zipCode && (
                    <FilterPill
                      label={`${state.zipCode} · ${state.radius} mi`}
                      onRemove={() => apply({ ...state, zipCode: '', sortBy: state.sortBy === 'distance' ? 'relevance' : state.sortBy })}
                    />
                  )}
                  {state.ageGroups.map((g) => (
                    <FilterPill
                      key={g}
                      label={ageGroupMeta(g)?.short ?? g}
                      onRemove={() => removeFilter('ageGroups', g)}
                    />
                  ))}
                  {state.disabilityIds.map((id) => (
                    <FilterPill
                      key={id}
                      label={nameFor.get(id) ?? 'Disability'}
                      onRemove={() => removeFilter('disabilityIds', id)}
                    />
                  ))}
                  {state.serviceTypeIds.map((id) => (
                    <FilterPill
                      key={id}
                      label={nameFor.get(id) ?? 'Service type'}
                      onRemove={() => removeFilter('serviceTypeIds', id)}
                    />
                  ))}
                  {state.verifiedOnly && (
                    <FilterPill label="Verified only" onRemove={() => apply({ ...state, verifiedOnly: false })} />
                  )}
                  {state.insuranceAccepted && (
                    <FilterPill label="Accepts insurance" onRemove={() => apply({ ...state, insuranceAccepted: false })} />
                  )}
                  <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs h-auto py-1">Clear All</Button>
                </div>
              )}
            </div>
          )}

          <div>
            {error && (
              <div className="theme-danger p-4 sm:p-6 mb-4 sm:mb-6" role="alert">
                <div className="flex items-start gap-3">
                  <div className="text-destructive text-xl sm:text-2xl flex-shrink-0" aria-hidden="true">⚠️</div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold mb-1 text-sm sm:text-base">Error Loading Listings</h3>
                    <p className="text-xs sm:text-sm mb-3 break-words">{error}</p>
                    <Button onClick={() => apply(state)} variant="outline" size="sm" className="border-destructive/50 text-destructive hover:bg-destructive/10">
                      Try Again
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div className="text-center py-8 sm:py-12" role="status" aria-live="polite">
                <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary mx-auto mb-4" aria-hidden="true" />
                <p className="text-muted-foreground text-sm sm:text-base">Searching...</p>
              </div>
            ) : !error && services.length === 0 ? (
              <EmptyState
                icon={<Search className="h-6 w-6" />}
                title="No listings found"
                description="We couldn't find anything matching your search. Try a different type tab, widen your location, or clear filters."
                action={
                  activeCount > 0 || state.query ? (
                    <Button onClick={clearAllFilters} variant="outline" size="lg" className="w-full sm:w-auto">
                      Clear Filters and Start Over
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <ServiceList services={services} />

                {/* Real pagination. This button used to reveal more of the twenty
                    listings already fetched, which meant everything past the first
                    page was unreachable no matter how many times it was pressed. */}
                {hasMore && (
                  <div className="flex flex-col items-center gap-2 pt-6 sm:pt-8">
                    <Button
                      variant="outline"
                      size="lg"
                      className="min-h-[44px] sm:min-h-[48px] px-6 sm:px-8 w-full sm:w-auto"
                      onClick={loadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                          Loading…
                        </>
                      ) : (
                        `Show more listings (${totalResults - services.length} left)`
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Showing {services.length} of {totalResults}
                    </p>
                  </div>
                )}
                {!hasMore && totalResults > PAGE_SIZE && (
                  <p className="pt-6 text-center text-xs text-muted-foreground">
                    That&apos;s all {totalResults} listings.
                  </p>
                )}
              </>
            )}
          </div>

          {/* The other half of the combined category. Rendered as its own band so
              it reads as a distinct kind of thing — free, no provider, nothing to
              book — rather than as more search results. */}
          {category?.includesResources && resources.length > 0 && (
            <section aria-labelledby="resources-heading" className="mt-10 border-t border-border/60 pt-8">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 id="resources-heading" className="flex items-center gap-2 text-lg sm:text-xl font-semibold">
                    <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
                    Free resources
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Guides, benefits information, and crisis directories — no account needed.
                  </p>
                </div>
                <Link
                  href="/resources"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  All resources
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                {resources.map((r) => {
                  const isExternal = !!r.externalUrl;
                  return (
                    <Link
                      key={r.id}
                      href={isExternal ? r.externalUrl! : `/resources/${r.slug}`}
                      {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className="block rounded-lg border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md"
                    >
                      <h3 className="mb-1 flex items-start gap-1.5 text-sm font-semibold leading-tight">
                        <span className="min-w-0">{r.title}</span>
                        {isExternal && (
                          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        )}
                      </h3>
                      {r.summary && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">{r.summary}</p>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          <LiabilityDisclaimer className="mt-8" />
        </section>
      </div>
    </div>
  );
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="theme-pill">
      <span className="truncate max-w-[160px] sm:max-w-none">{label}</span>
      <button
        onClick={onRemove}
        className="hover:bg-primary/10 rounded-full p-0.5 ml-1 flex-shrink-0 min-w-[20px] min-h-[20px] flex items-center justify-center"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  );
}

function TabButton({
  active, icon, label, onClick,
}: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors min-h-[40px] whitespace-nowrap',
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40'
      )}
    >
      {icon}
      {label}
    </button>
  );
}
