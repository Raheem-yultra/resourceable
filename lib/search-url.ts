/**
 * Serialising the browse state into the address bar, and back out again.
 *
 * Until now none of it lived in the URL. A family who filtered to "Speech Therapy,
 * autism, within 10 miles of 60601" could not send that to their partner, could
 * not bookmark it, and lost all of it the moment they opened a listing and pressed
 * Back — the panel reopened empty and the results reset to everything. For a
 * directory whose entire purpose is helping people find and share providers, that
 * is the most expensive thing the site forgets.
 *
 * The shape here is deliberately the *user's* vocabulary (`q`, `zip`, `miles`)
 * rather than the API's (`query`, `zipCode`, `radius`). A URL is something people
 * read and edit by hand; the API contract is free to differ and is translated in
 * one place.
 */

export interface SearchState {
  query: string;
  zipCode: string;
  radius: number;
  /** Disability ids. Names are resolved from the loaded options. */
  disabilityIds: string[];
  /** ServiceType ids. */
  serviceTypeIds: string[];
  /** AgeGroup enum values. */
  ageGroups: string[];
  verifiedOnly: boolean;
  insuranceAccepted: boolean;
  sortBy: SortOption;
}

export type SortOption = 'relevance' | 'rating' | 'newest' | 'distance';

export const DEFAULT_RADIUS = 25;

export const EMPTY_SEARCH_STATE: SearchState = {
  query: '',
  zipCode: '',
  radius: DEFAULT_RADIUS,
  disabilityIds: [],
  serviceTypeIds: [],
  ageGroups: [],
  verifiedOnly: false,
  insuranceAccepted: false,
  sortBy: 'relevance',
};

const SORT_VALUES: SortOption[] = ['relevance', 'rating', 'newest', 'distance'];

/**
 * Read state out of the address bar.
 *
 * Every field is treated as untrusted: a hand-edited or stale URL must produce a
 * usable search, never a crash or an empty page. Unrecognised values fall back to
 * the default for that field rather than rejecting the whole URL.
 */
export function parseSearchState(params: URLSearchParams): SearchState {
  const rawRadius = Number(params.get('miles'));
  const rawSort = params.get('sort') as SortOption | null;

  return {
    query: params.get('q') ?? '',
    zipCode: (params.get('zip') ?? '').replace(/\D/g, '').slice(0, 5),
    radius:
      Number.isFinite(rawRadius) && rawRadius >= 5 && rawRadius <= 100
        ? Math.round(rawRadius)
        : DEFAULT_RADIUS,
    disabilityIds: params.getAll('disability').filter(Boolean),
    serviceTypeIds: params.getAll('type').filter(Boolean),
    ageGroups: params.getAll('age').filter(Boolean),
    verifiedOnly: params.get('verified') === '1',
    insuranceAccepted: params.get('insurance') === '1',
    sortBy: rawSort && SORT_VALUES.includes(rawSort) ? rawSort : 'relevance',
  };
}

/**
 * Write state into the address bar.
 *
 * Defaults are omitted rather than spelled out, so an untouched browse page keeps
 * a clean `/browse` and only the choices a user actually made show up in a link
 * they share. `listingType` is not here at all: it is the path segment
 * (/browse/therapies), which is what makes each category a page a crawler and a
 * person can both link to.
 */
export function serializeSearchState(state: SearchState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.query.trim()) params.set('q', state.query.trim());
  if (state.zipCode) {
    params.set('zip', state.zipCode);
    // Radius is meaningless without an origin, so it only travels with a ZIP.
    if (state.radius !== DEFAULT_RADIUS) params.set('miles', String(state.radius));
  }
  state.disabilityIds.forEach((id) => params.append('disability', id));
  state.serviceTypeIds.forEach((id) => params.append('type', id));
  state.ageGroups.forEach((g) => params.append('age', g));
  if (state.verifiedOnly) params.set('verified', '1');
  if (state.insuranceAccepted) params.set('insurance', '1');
  if (state.sortBy !== 'relevance') params.set('sort', state.sortBy);

  return params;
}

/**
 * Translate user-facing state into the parameters GET /api/search expects.
 *
 * Kept next to the URL codec on purpose: these two are the only places that know
 * how a search is spelled, and a name that changes in one has an obvious partner
 * to change in the other.
 */
export function toApiParams(
  state: SearchState,
  options: { listingType?: string; ageGroup?: string; page?: number; limit?: number }
): URLSearchParams {
  const params = new URLSearchParams();

  if (state.query.trim()) params.set('query', state.query.trim());
  if (state.zipCode) {
    params.set('zipCode', state.zipCode);
    params.set('radius', String(state.radius));
  }
  state.disabilityIds.forEach((id) => params.append('disabilityId', id));
  state.serviceTypeIds.forEach((id) => params.append('serviceTypeId', id));

  if (options.listingType) params.set('listingType', options.listingType);

  // A category that pins an age (21+) wins over the age chips rather than unioning
  // with them — the API treats repeated ageGroup as OR, so sending both would widen
  // "21+" back out to include children.
  if (options.ageGroup) {
    params.set('ageGroup', options.ageGroup);
  } else {
    state.ageGroups.forEach((g) => params.append('ageGroup', g));
  }

  if (state.verifiedOnly) params.set('verifiedOnly', 'true');
  if (state.insuranceAccepted) params.set('insuranceAccepted', 'true');

  // Sorting by distance without a ZIP has no origin to measure from. Asking for it
  // anyway would make the API quietly fall back; ask for what it can actually do.
  const sort = state.sortBy === 'distance' && !state.zipCode ? 'relevance' : state.sortBy;
  params.set('sortBy', sort);

  params.set('page', String(options.page ?? 1));
  params.set('limit', String(options.limit ?? 20));

  return params;
}

/** How many filters are switched on — drives the badge on the Filters button. */
export function countActiveFilters(state: SearchState): number {
  return (
    state.disabilityIds.length +
    state.serviceTypeIds.length +
    state.ageGroups.length +
    (state.zipCode ? 1 : 0) +
    (state.verifiedOnly ? 1 : 0) +
    (state.insuranceAccepted ? 1 : 0)
  );
}
