'use client';

import { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, X, Filter } from 'lucide-react';
import { SearchFilters } from '@/components/search/SearchFilters';
import { ServiceList } from '@/components/search/ServiceList';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

type SortOption = 'relevance' | 'price' | 'rating' | 'distance' | 'newest';

interface ActiveFilters {
  disabilities: Array<{ id: string; name: string }>;
  serviceTypes: Array<{ id: string; name: string }>;
  zipCode: string;
  radius: number;
  priceRange?: { min: number; max: number };
}

export default function SearchPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalResults, setTotalResults] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
    disabilities: [],
    serviceTypes: [],
    zipCode: '',
    radius: 25,
  });

  // Initial load - fetch all services
  useEffect(() => {
    handleSearch({});
  }, []);

  // Re-search when sort changes
  useEffect(() => {
    if (services.length > 0) {
      handleSearch({
        query: searchQuery,
        ...activeFilters,
        sortBy,
      });
    }
  }, [sortBy]);

  const handleSearch = async (filters: any) => {
    setLoading(true);
    setError(null);
    
    // Announce to screen readers that search is loading
    const announcement = document.getElementById('search-announcement');
    if (announcement) {
      announcement.textContent = 'Searching for services...';
    }
    
    try {
      const params = new URLSearchParams();
      
      // Add query
      if (filters.query) {
        params.append('query', filters.query);
      }
      
      // Add location
      if (filters.zipCode) {
        params.append('zipCode', filters.zipCode);
      }
      if (filters.radius) {
        params.append('radius', filters.radius.toString());
      }
      
      // Add disabilities (multiple IDs)
      if (filters.disabilities && filters.disabilities.length > 0) {
        filters.disabilities.forEach((d: { id: string }) => {
          params.append('disabilityId', d.id);
        });
      }
      
      // Add service types (multiple IDs)
      if (filters.serviceTypes && filters.serviceTypes.length > 0) {
        filters.serviceTypes.forEach((s: { id: string }) => {
          params.append('serviceTypeId', s.id);
        });
      }
      
      // Add price range
      if (filters.priceMin !== undefined) {
        params.append('priceMin', filters.priceMin.toString());
      }
      if (filters.priceMax !== undefined) {
        params.append('priceMax', filters.priceMax.toString());
      }

      // Add sort
      const sortValue = filters.sortBy || sortBy;
      if (sortValue) {
        params.append('sortBy', sortValue);
      }

      const response = await fetch(`/api/search?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setServices(data.services || []);
        setTotalResults(data.pagination?.total || data.services?.length || 0);
        
        // Announce results to screen readers
        if (announcement) {
          const count = data.services?.length || 0;
          announcement.textContent = `Found ${count} service${count !== 1 ? 's' : ''}`;
        }
        
        // Update active filters for display
        if (filters.disabilities || filters.serviceTypes || filters.zipCode) {
          setActiveFilters({
            disabilities: filters.disabilities || [],
            serviceTypes: filters.serviceTypes || [],
            zipCode: filters.zipCode || '',
            radius: filters.radius || 25,
            priceRange: filters.priceMin !== undefined ? { min: filters.priceMin, max: filters.priceMax } : undefined,
          });
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Search failed' }));
        // Show debug info if available
        const errorMessage = errorData.debug || errorData.error || 'Failed to load services. Please try again.';
        setError(errorMessage);
        setServices([]);
        setTotalResults(0);
        
        // Announce error to screen readers
        if (announcement) {
          announcement.textContent = `Error: ${errorMessage}`;
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
      const errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
      setError(errorMessage);
      setServices([]);
      setTotalResults(0);
      
      // Announce error to screen readers
      const announcement = document.getElementById('search-announcement');
      if (announcement) {
        announcement.textContent = errorMessage;
      }
    } finally {
      setLoading(false);
    }
  };

  const removeDisabilityFilter = (disabilityId: string) => {
    const newFilters = {
      ...activeFilters,
      disabilities: activeFilters.disabilities.filter(d => d.id !== disabilityId),
    };
    setActiveFilters(newFilters);
    handleSearch({ query: searchQuery, ...newFilters, sortBy });
  };

  const removeServiceTypeFilter = (serviceTypeId: string) => {
    const newFilters = {
      ...activeFilters,
      serviceTypes: activeFilters.serviceTypes.filter(s => s.id !== serviceTypeId),
    };
    setActiveFilters(newFilters);
    handleSearch({ query: searchQuery, ...newFilters, sortBy });
  };

  const clearAllFilters = () => {
    const newFilters = {
      disabilities: [],
      serviceTypes: [],
      zipCode: '',
      radius: 25,
    };
    setActiveFilters(newFilters);
    setSearchQuery('');
    handleSearch(newFilters);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Skip to main content link for screen readers and keyboard users */}
      <a href="#main-content" className="skip-to-main">
        Skip to search results
      </a>
      
      {/* Screen reader announcements for search status */}
      <div
        id="search-announcement"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:py-8">
        {/* Search Bar & Filters Button */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-4 sm:mb-6">Find Special Needs Services</h1>
          <div className="flex flex-col gap-3 sm:gap-4">
            {/* Search Input Row */}
            <div className="relative flex-1">
              <label htmlFor="search-input" className="sr-only">
                Search for services
              </label>
              <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground pointer-events-none" aria-hidden="true" />
              <Input
                id="search-input"
                type="search"
                placeholder="Search for services... (e.g., speech therapy, behavioral support)"
                className="h-11 sm:h-12 pl-10 sm:pl-12 pr-4 text-sm sm:text-base"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch({ query: searchQuery, ...activeFilters });
                  }
                }}
                aria-describedby="search-hint"
              />
              <span id="search-hint" className="sr-only">
                Press Enter to search, or use the Filters button to refine your search
              </span>
            </div>
            
            {/* Buttons Row */}
            <div className="flex gap-2 sm:gap-3">
              {/* Filters Button */}
              <Sheet open={showFilters} onOpenChange={setShowFilters}>
                <SheetTrigger asChild>
                  <Button 
                    size="lg" 
                    className="h-11 sm:h-12 gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all flex-1 sm:flex-none sm:px-6"
                    aria-label={`Filters${(activeFilters.disabilities.length + activeFilters.serviceTypes.length) > 0 ? `, ${activeFilters.disabilities.length + activeFilters.serviceTypes.length} active` : ''}`}
                  >
                    <Filter className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                    <span className="font-semibold text-sm sm:text-base">Filters</span>
                    {(activeFilters.disabilities.length + activeFilters.serviceTypes.length) > 0 && (
                      <span className="ml-1 bg-white text-purple-700 rounded-full px-2 py-0.5 text-xs font-bold" aria-hidden="true">
                        {activeFilters.disabilities.length + activeFilters.serviceTypes.length}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Filter Services</SheetTitle>
                    <SheetDescription>
                      Refine your search to find the perfect service
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">
                    {/* Sort By */}
                    <div className="bg-card rounded-lg border p-4 mb-4">
                      <h3 className="font-semibold mb-3">Sort by</h3>
                      <div className="space-y-2">
                        {[
                          { value: 'relevance', label: 'Recommended' },
                          { value: 'price', label: 'Price: Low → High' },
                          { value: 'rating', label: 'Highest Rated' },
                          { value: 'distance', label: 'Distance' },
                          { value: 'newest', label: 'Newest' },
                        ].map((option) => (
                          <label
                            key={option.value}
                            className="flex items-center gap-2 cursor-pointer hover:bg-accent p-2 rounded min-h-[44px]"
                          >
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
                    <SearchFilters onSearch={(filters) => {
                      handleSearch({ query: searchQuery, ...filters });
                      setShowFilters(false);
                    }} />
                  </div>
                </SheetContent>
              </Sheet>
              
              {/* Search Button */}
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

        {/* Results Header */}
        <main id="main-content" tabIndex={-1}>
          {services.length > 0 && (
            <div className="mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 sm:mb-4">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold">
                  <span className="text-primary">{totalResults} service{totalResults !== 1 ? 's' : ''}</span>
                  {searchQuery && <span className="hidden sm:inline"> matching "{searchQuery}"</span>}
                </h2>
              </div>

              {/* Active Filters Display */}
              {(activeFilters.disabilities.length > 0 || activeFilters.serviceTypes.length > 0) && (
                <div className="flex flex-wrap gap-2 mb-3 sm:mb-4" role="group" aria-label="Active filters">
                  {activeFilters.disabilities.map((disability) => (
                    <span
                      key={disability.id}
                      className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs sm:text-sm"
                    >
                      <span className="truncate max-w-[120px] sm:max-w-none">{disability.name}</span>
                      <button
                        onClick={() => removeDisabilityFilter(disability.id)}
                        className="hover:bg-purple-100 rounded-full p-0.5 ml-1 flex-shrink-0 min-w-[20px] min-h-[20px] flex items-center justify-center"
                        aria-label={`Remove ${disability.name} filter`}
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  {activeFilters.serviceTypes.map((serviceType) => (
                    <span
                      key={serviceType.id}
                      className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs sm:text-sm"
                    >
                      <span className="truncate max-w-[120px] sm:max-w-none">{serviceType.name}</span>
                      <button
                        onClick={() => removeServiceTypeFilter(serviceType.id)}
                        className="hover:bg-blue-100 rounded-full p-0.5 ml-1 flex-shrink-0 min-w-[20px] min-h-[20px] flex items-center justify-center"
                        aria-label={`Remove ${serviceType.name} filter`}
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="text-xs h-auto py-1"
                  >
                    Clear All
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {/* Results */}
          <div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6" role="alert">
                <div className="flex items-start gap-3">
                  <div className="text-red-600 text-xl sm:text-2xl flex-shrink-0" aria-hidden="true">⚠️</div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-red-900 mb-1 text-sm sm:text-base">Error Loading Services</h3>
                    <p className="text-red-700 text-xs sm:text-sm mb-3 break-words">{error}</p>
                    <Button
                      onClick={() => handleSearch({ query: searchQuery, ...activeFilters })}
                      variant="outline"
                      size="sm"
                      className="border-red-300 text-red-700 hover:bg-red-100"
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {loading ? (
              <div className="text-center py-8 sm:py-12" role="status" aria-live="polite">
                <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary mx-auto mb-4" aria-hidden="true"></div>
                <p className="text-muted-foreground text-sm sm:text-base">Searching for services...</p>
              </div>
            ) : !error && services.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 sm:p-8 lg:p-12 text-center" role="status">
                <div className="text-4xl sm:text-5xl lg:text-6xl mb-4" aria-hidden="true">🔍</div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">No services found</h3>
                <p className="text-gray-600 mb-4 sm:mb-6 max-w-md mx-auto text-sm sm:text-base">
                  We couldn't find any services matching your search. Try adjusting your filters or search terms to find what you're looking for.
                </p>
                {(activeFilters.disabilities.length > 0 || activeFilters.serviceTypes.length > 0 || activeFilters.zipCode) && (
                  <Button onClick={clearAllFilters} variant="outline" size="lg" className="w-full sm:w-auto">
                    Clear Filters and Start Over
                  </Button>
                )}
              </div>
            ) : (
              <ServiceList services={services} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
