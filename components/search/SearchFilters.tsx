'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MapPin, ChevronDown, ChevronUp } from 'lucide-react';

interface SearchFiltersProps {
  onSearch: (filters: any) => void;
}

interface Disability {
  id: string;
  name: string;
  slug: string;
}

interface ServiceType {
  id: string;
  name: string;
  slug: string;
}

const PRICE_RANGES = [
  { min: 0, max: 50, label: 'Under $50' },
  { min: 50, max: 100, label: '$50 - $100' },
  { min: 100, max: 200, label: '$100 - $200' },
  { min: 200, max: 500, label: '$200 - $500' },
  { min: 500, max: 999999, label: '$500+' },
];

export function SearchFilters({ onSearch }: SearchFiltersProps) {
  const [disabilities, setDisabilities] = useState<Disability[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [zipCode, setZipCode] = useState('');
  const [radius, setRadius] = useState(25);
  const [selectedDisabilities, setSelectedDisabilities] = useState<Disability[]>([]);
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<ServiceType[]>([]);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number } | null>(null);
  const [showAllDisabilities, setShowAllDisabilities] = useState(false);
  const [showAllServices, setShowAllServices] = useState(false);

  // Fetch disabilities and service types from API
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        // Fetch disabilities
        const disabilitiesRes = await fetch('/api/disabilities');
        if (disabilitiesRes.ok) {
          const disabilitiesData = await disabilitiesRes.json();
          setDisabilities(disabilitiesData.disabilities || []);
        }

        // Fetch service types
        const serviceTypesRes = await fetch('/api/service-types');
        if (serviceTypesRes.ok) {
          const serviceTypesData = await serviceTypesRes.json();
          setServiceTypes(serviceTypesData.serviceTypes || []);
        }
      } catch (error) {
        console.error('Failed to fetch filter options:', error);
      }
    };

    fetchFilters();
  }, []);

  const toggleDisability = (disability: Disability) => {
    setSelectedDisabilities((prev) => {
      const exists = prev.find(d => d.id === disability.id);
      if (exists) {
        return prev.filter((d) => d.id !== disability.id);
      } else {
        return [...prev, disability];
      }
    });
  };

  const toggleServiceType = (serviceType: ServiceType) => {
    setSelectedServiceTypes((prev) => {
      const exists = prev.find(s => s.id === serviceType.id);
      if (exists) {
        return prev.filter((s) => s.id !== serviceType.id);
      } else {
        return [...prev, serviceType];
      }
    });
  };

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
    onSearch({
      disabilities: [],
      serviceTypes: [],
      radius: 25,
    });
  };

  const visibleDisabilities = showAllDisabilities ? disabilities : disabilities.slice(0, 6);
  const visibleServiceTypes = showAllServices ? serviceTypes : serviceTypes.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Clear All Button */}
      {(selectedDisabilities.length > 0 || selectedServiceTypes.length > 0 || priceRange) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearAll}
          className="w-full"
          aria-label={`Clear all ${selectedDisabilities.length + selectedServiceTypes.length} active filters`}
        >
          Clear All Filters
        </Button>
      )}

      {/* Location Filter */}
      <div className="bg-card rounded-lg border p-4">
        <h3 className="font-semibold mb-4" id="location-filter">Location</h3>
        <div className="space-y-3" role="group" aria-labelledby="location-filter">
          <div className="relative">
            <label htmlFor="zip-code-input" className="sr-only">
              ZIP code
            </label>
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
            <Input
              id="zip-code-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{5}"
              maxLength={5}
              placeholder="Enter ZIP code"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              className="pl-10"
              aria-describedby="zip-code-hint"
            />
            <span id="zip-code-hint" className="sr-only">
              Enter a 5-digit ZIP code to search for services near you
            </span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="radius-slider" className="text-sm text-muted-foreground">
              Distance: {radius} miles
            </Label>
            <input
              id="radius-slider"
              type="range"
              min="5"
              max="100"
              step="5"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              aria-label={`Search radius: ${radius} miles`}
            />
            <div className="flex justify-between text-xs text-muted-foreground" aria-hidden="true">
              <span>5 mi</span>
              <span>100 mi</span>
            </div>
          </div>
        </div>
      </div>

      {/* Disability Types Filter */}
      <div className="bg-card rounded-lg border p-4">
        <h3 className="font-semibold mb-3" id="disability-filter">Filter by Disability</h3>
        {disabilities.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Loading disability options...
          </p>
        ) : (
          <>
            <div className="space-y-2 max-h-64 overflow-y-auto" role="group" aria-labelledby="disability-filter">
              {visibleDisabilities.map((disability) => (
                <label
                  key={disability.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-accent p-2 rounded group min-h-[44px]"
                >
                  <input
                    type="checkbox"
                    checked={selectedDisabilities.some(d => d.id === disability.id)}
                    onChange={() => toggleDisability(disability)}
                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-2 cursor-pointer"
                    aria-label={disability.name}
                  />
                  <span className="text-sm group-hover:text-primary">{disability.name}</span>
                </label>
              ))}
            </div>
            {disabilities.length > 6 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllDisabilities(!showAllDisabilities)}
                className="w-full mt-2 text-xs min-h-[44px]"
                aria-expanded={showAllDisabilities}
                aria-label={showAllDisabilities ? 'Show fewer disability options' : `Show all ${disabilities.length} disability options`}
              >
                {showAllDisabilities ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" aria-hidden="true" /> Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" aria-hidden="true" /> Show All ({disabilities.length})
                  </>
                )}
              </Button>
            )}
          </>
        )}
      </div>

      {/* Service Types Filter */}
      <div className="bg-card rounded-lg border p-4">
        <h3 className="font-semibold mb-3" id="service-type-filter">Filter by Service Type</h3>
        {serviceTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Loading service type options...
          </p>
        ) : (
          <>
            <div className="space-y-2 max-h-64 overflow-y-auto" role="group" aria-labelledby="service-type-filter">
              {visibleServiceTypes.map((serviceType) => (
                <label
                  key={serviceType.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-accent p-2 rounded group min-h-[44px]"
                >
                  <input
                    type="checkbox"
                    checked={selectedServiceTypes.some(s => s.id === serviceType.id)}
                    onChange={() => toggleServiceType(serviceType)}
                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-2 cursor-pointer"
                    aria-label={serviceType.name}
                  />
                  <span className="text-sm group-hover:text-primary">{serviceType.name}</span>
                </label>
              ))}
            </div>
            {serviceTypes.length > 6 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllServices(!showAllServices)}
                className="w-full mt-2 text-xs min-h-[44px]"
                aria-expanded={showAllServices}
                aria-label={showAllServices ? 'Show fewer service type options' : `Show all ${serviceTypes.length} service type options`}
              >
                {showAllServices ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" aria-hidden="true" /> Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" aria-hidden="true" /> Show All ({serviceTypes.length})
                  </>
                )}
              </Button>
            )}
          </>
        )}
      </div>

      {/* Price Range Filter */}
      <div className="bg-card rounded-lg border p-4">
        <h3 className="font-semibold mb-3" id="price-filter">Price Range</h3>
        <div className="space-y-2" role="radiogroup" aria-labelledby="price-filter">
          {PRICE_RANGES.map((range) => (
            <label
              key={range.label}
              className="flex items-center gap-2 cursor-pointer hover:bg-accent p-2 rounded group min-h-[44px]"
            >
              <input
                type="radio"
                name="priceRange"
                checked={priceRange?.min === range.min && priceRange?.max === range.max}
                onChange={() => setPriceRange({ min: range.min, max: range.max })}
                className="h-5 w-5 text-primary focus:ring-primary focus:ring-offset-2 cursor-pointer"
                aria-label={range.label}
              />
              <span className="text-sm group-hover:text-primary">{range.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Apply Filters Button */}
      <Button
        onClick={handleApplyFilters}
        className="w-full min-h-[48px] text-base font-semibold"
        size="lg"
      >
        Apply Filters
        {(selectedDisabilities.length + selectedServiceTypes.length) > 0 && (
          <span className="ml-2 bg-white text-primary rounded-full px-2 py-0.5 text-xs font-bold">
            {selectedDisabilities.length + selectedServiceTypes.length}
          </span>
        )}
      </Button>
    </div>
  );
}
