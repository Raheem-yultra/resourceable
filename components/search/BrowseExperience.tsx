'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, X, Filter,
  LayoutGrid, Stethoscope, HeartHandshake, ShoppingBag, GraduationCap, CalendarDays,
} from 'lucide-react';
import { SearchFilters } from '@/components/search/SearchFilters';
import { ServiceList } from '@/components/search/ServiceList';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { LiabilityDisclaimer } from '@/components/listing/LiabilityDisclaimer';
import { LISTING_TYPES, type BookableListingType } from '@/lib/listing-taxonomy';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';

type SortOption = 'relevance' | 'price' | 'rating' | 'distance' | 'newest';

interface ActiveFilters {
  disabilities: Array<{ id: string; name: string }>;
  serviceTypes: Array<{ id: string; name: string }>;
  zipCode: string;
  radius: number;
  priceRange?: { min: number; max: number };
}

const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Stethoscope, HeartHandshake, ShoppingBag, GraduationCap, CalendarDays,
};

export interface BrowseExperienceProps {
  /** Pre-select a listing-type tab. Omit for the unified "All" view. */
  initialListingType?: BookableListingType;
  /** Pre-apply an age-group filter (used by the /browse/21-plus landing page). */
  initialAgeGroup?: string;
  /** Page heading. */
  title?: string;
  /** Short intro line under the heading. */
  subtitle?: string;
  /** Reflect the active tab in the URL (/browse/<slug>). Off for /search. */
  syncUrl?: boolean;
  /** Show the listing-type tab bar. */
  showTabs?: boolean;
}

/**
 * The shared browse/search experience (plan §5–§7). Powers /search, /browse, and
 * every /browse/<type> route. A listing-type tab bar switches the unified search
 * between "All" and a single type; location/keyword persist across tab switches
 * (only the type changes), matching plan §7.2's "filter state loss" guardrail.
 */
export function BrowseExperience({
  initialListingType,
  initialAgeGroup,
  title = 'Find Disability Services',
  subtitle,
  syncUrl = false,
  showTabs = true,
}: BrowseExperienceProps) {
  const router = useRouter();
  const [services, setServices] = useState<any[]>([]);
  // Start in the loading state: the initial fetch fires on mount, so showing the
  // spinner immediately avoids a flash of the "No listings found" empty state.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Monotonic request id: only the most recent search may update state, so a slow
  // earlier request can't clobber a newer one or leave the spinner stuck.
  const reqIdRef = useRef(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalResults, setTotalResults] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [showFilters, setShowFilters] = useState(false);
  const [listingType, setListingType] = useState<BookableListingType | undefined>(initialListingType);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
    disabilities: [],
    serviceTypes: [],
    zipCode: '',
    radius: 25,
  });

  const buildParams = useCallback(
    (filters: any, type: BookableListingType | undefined) => {
      const params = new URLSearchParams();
      if (filters.query) params.append('query', filters.query);
      if (filters.zipCode) params.append('zipCode', filters.zipCode);
      if (filters.radius) params.append('radius', filters.radius.toString());
      (filters.disabilities || []).forEach((d: { id: string }) => params.append('disabilityId', d.id));
      (filters.serviceTypes || []).forEach((s: { id: string }) => params.append('serviceTypeId', s.id));
      if (filters.priceMin !== undefined) params.append('priceMin', filters.priceMin.toString());
      if (filters.priceMax !== undefined) params.append('priceMax', filters.priceMax.toString());
      if (type) params.append('listingType', type);
      if (initialAgeGroup) params.append('ageGroup', initialAgeGroup);
      params.append('sortBy', filters.sortBy || sortBy);
      return params;
    },
    [initialAgeGroup, sortBy]
  );

  const handleSearch = useCallback(
    async (filters: any, type: BookableListingType | undefined = listingType) => {
      const reqId = ++reqIdRef.current;
      const isCurrent = () => reqId === reqIdRef.current;
      setLoading(true);
      setError(null);
      const announcement = document.getElementById('search-announcement');
      if (announcement) announcement.textContent = 'Searching for listings...';

      // Never let a hung request spin forever: abort after 15s so the user gets a
      // retryable error instead of a frozen spinner.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      try {
        const params = buildParams(filters, type);
        const response = await fetch(`/api/search?${params.toString()}`, { signal: controller.signal });
        if (!isCurrent()) return; // a newer search superseded this one
        if (response.ok) {
          const data = await response.json();
          setServices(data.services || []);
          setTotalResults(data.pagination?.total || data.services?.length || 0);
          if (announcement) {
            const count = data.services?.length || 0;
            announcement.textContent = `Found ${count} listing${count !== 1 ? 's' : ''}`;
          }
          if (filters.disabilities || filters.serviceTypes || filters.zipCode) {
            setActiveFilters({
              disabilities: filters.disabilities || [],
              serviceTypes: filters.serviceTypes || [],
              zipCode: filters.zipCode || '',
              radius: filters.radius || 25,
              priceRange:
                filters.priceMin !== undefined ? { min: filters.priceMin, max: filters.priceMax } : undefined,
            });
          }
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Search failed' }));
          const message = errorData.error || 'Failed to load listings. Please try again.';
          setError(message);
          setServices([]);
          setTotalResults(0);
          if (announcement) announcement.textContent = `Error: ${message}`;
        }
      } catch (err: any) {
        // Ignore aborts caused by a newer search taking over — that request owns the UI.
        if (!isCurrent()) return;
        const message =
          err?.name === 'AbortError'
            ? 'This search took too long. Please try again.'
            : 'Unable to connect to the server. Please check your connection and try again.';
        console.error('Search failed:', err);
        setError(message);
        setServices([]);
        setTotalResults(0);
        if (announcement) announcement.textContent = message;
      } finally {
        clearTimeout(timeout);
        if (isCurrent()) setLoading(false);
      }
    },
    [buildParams, listingType]
  );

  // Initial load + re-search on sort change.
  useEffect(() => {
    handleSearch({ query: searchQuery, ...activeFilters });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy]);

  const selectType = (type: BookableListingType | undefined) => {
    setListingType(type);
    handleSearch({ query: searchQuery, ...activeFilters }, type);
    if (syncUrl) {
      const meta = LISTING_TYPES.find((t) => t.type === type);
      router.replace(meta ? `/browse/${meta.slug}` : '/browse');
    }
  };

  const removeDisabilityFilter = (id: string) => {
    const next = { ...activeFilters, disabilities: activeFilters.disabilities.filter((d) => d.id !== id) };
    setActiveFilters(next);
    handleSearch({ query: searchQuery, ...next });
  };
  const removeServiceTypeFilter = (id: string) => {
    const next = { ...activeFilters, serviceTypes: activeFilters.serviceTypes.filter((s) => s.id !== id) };
    setActiveFilters(next);
    handleSearch({ query: searchQuery, ...next });
  };
  const clearAllFilters = () => {
    const next = { disabilities: [], serviceTypes: [], zipCode: '', radius: 25 };
    setActiveFilters(next);
    setSearchQuery('');
    handleSearch(next);
  };

  const activeCount = activeFilters.disabilities.length + activeFilters.serviceTypes.length;

  return (
    <div className="min-h-screen">
      <div id="search-announcement" role="status" aria-live="polite" aria-atomic="true" className="sr-only" />

      <div className="page-wrap">
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2">{title}</h1>
          {subtitle && <p className="text-sm sm:text-base text-muted-foreground mb-4">{subtitle}</p>}

          {/* Listing-type tabs (plan §5/§7.1) */}
          {showTabs && (
            <div className="mb-4 overflow-x-auto -mx-1 px-1" role="tablist" aria-label="Listing types">
              <div className="flex gap-2 min-w-max pb-1">
                <TabButton
                  active={!listingType}
                  icon={<LayoutGrid className="h-4 w-4" aria-hidden="true" />}
                  label="All"
                  onClick={() => selectType(undefined)}
                />
                {LISTING_TYPES.map((t) => {
                  const Icon = TAB_ICONS[t.icon] || LayoutGrid;
                  return (
                    <TabButton
                      key={t.type}
                      active={listingType === t.type}
                      icon={<Icon className="h-4 w-4" aria-hidden="true" />}
                      label={t.label}
                      onClick={() => selectType(t.type)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="relative flex-1">
              <label htmlFor="search-input" className="sr-only">Search for listings</label>
              <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground pointer-events-none" aria-hidden="true" />
              <Input
                id="search-input"
                type="search"
                placeholder="Search... (e.g., speech therapy, wheelchair, support group)"
                className="h-11 sm:h-12 pl-10 sm:pl-12 pr-4 text-sm sm:text-base"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch({ query: searchQuery, ...activeFilters }); }}
              />
            </div>

            <div className="flex gap-2 sm:gap-3">
              <Sheet open={showFilters} onOpenChange={setShowFilters}>
                <SheetTrigger asChild>
                  <Button
                    size="lg"
                    className="h-11 sm:h-12 gap-2 shadow-sm transition-all flex-1 sm:flex-none sm:px-6"
                    aria-label={`Filters${activeCount > 0 ? `, ${activeCount} active` : ''}`}
                  >
                    <Filter className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                    <span className="font-semibold text-sm sm:text-base">Filters</span>
                    {activeCount > 0 && (
                      <span className="ml-1 bg-background text-primary rounded-full px-2 py-0.5 text-xs font-bold" aria-hidden="true">
                        {activeCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Filter Listings</SheetTitle>
                    <SheetDescription>Refine your search to find the right fit</SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">
                    <div className="bg-card rounded-lg border p-4 mb-4">
                      <h3 className="font-semibold mb-3">Sort by</h3>
                      <div className="space-y-2">
                        {[
                          { value: 'relevance', label: 'Recommended' },
                          { value: 'price', label: 'Price: Low → High' },
                          { value: 'rating', label: 'Highest Rated' },
                          { value: 'newest', label: 'Newest' },
                        ].map((option) => (
                          <label key={option.value} className="flex items-center gap-2 cursor-pointer hover:bg-accent p-2 rounded min-h-[44px]">
                            <input
                              type="radio"
                              name="sort"
                              value={option.value}
                              checked={sortBy === option.value}
                              onChange={(e) => setSortBy(e.target.value as SortOption)}
                              className="h-4 w-4"
                            />
                            <span className="text-sm">{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <SearchFilters onSearch={(filters) => { handleSearch({ query: searchQuery, ...filters }); setShowFilters(false); }} />
                  </div>
                </SheetContent>
              </Sheet>

              <Button
                size="lg"
                className="h-11 sm:h-12 px-4 sm:px-8 flex-1 sm:flex-none text-sm sm:text-base"
                onClick={() => handleSearch({ query: searchQuery, ...activeFilters })}
              >
                Search
              </Button>
            </div>
          </div>
        </div>

        <section id="search-results" tabIndex={-1}>
          {services.length > 0 && (
            <div className="mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-3 sm:mb-4">
                <span className="text-primary">{totalResults} listing{totalResults !== 1 ? 's' : ''}</span>
                {searchQuery && <span className="hidden sm:inline"> matching &quot;{searchQuery}&quot;</span>}
              </h2>

              {activeCount > 0 && (
                <div className="flex flex-wrap gap-2 mb-3 sm:mb-4" role="group" aria-label="Active filters">
                  {activeFilters.disabilities.map((d) => (
                    <span key={d.id} className="theme-pill">
                      <span className="truncate max-w-[120px] sm:max-w-none">{d.name}</span>
                      <button onClick={() => removeDisabilityFilter(d.id)} className="hover:bg-primary/10 rounded-full p-0.5 ml-1 flex-shrink-0 min-w-[20px] min-h-[20px] flex items-center justify-center" aria-label={`Remove ${d.name} filter`}>
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  {activeFilters.serviceTypes.map((s) => (
                    <span key={s.id} className="theme-pill">
                      <span className="truncate max-w-[120px] sm:max-w-none">{s.name}</span>
                      <button onClick={() => removeServiceTypeFilter(s.id)} className="hover:bg-primary/10 rounded-full p-0.5 ml-1 flex-shrink-0 min-w-[20px] min-h-[20px] flex items-center justify-center" aria-label={`Remove ${s.name} filter`}>
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
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
                    <Button onClick={() => handleSearch({ query: searchQuery, ...activeFilters })} variant="outline" size="sm" className="border-destructive/50 text-destructive hover:bg-destructive/10">
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
                  activeCount > 0 || activeFilters.zipCode ? (
                    <Button onClick={clearAllFilters} variant="outline" size="lg" className="w-full sm:w-auto">
                      Clear Filters and Start Over
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ServiceList services={services} />
            )}
          </div>

          <LiabilityDisclaimer className="mt-8" />
        </section>
      </div>
    </div>
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
