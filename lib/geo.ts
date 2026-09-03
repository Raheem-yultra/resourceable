import { prisma } from '@/lib/prisma';

/**
 * Proximity search, without a geocoding dependency.
 *
 * The filter panel has always offered "ZIP code" + "within N miles". Underneath,
 * ZIP did a bare `contains` string match on the business ZIP and the radius was
 * dropped on the floor — the API parsed it, validated it, and never referenced it
 * again. So the slider moved, the wording changed, and the results did not. A
 * control that cannot affect the answer is worse than no control: it teaches the
 * family that the site has no listings near them when it has plenty.
 *
 * Making it real needs one thing the app did not have: a latitude/longitude for
 * the ZIP the user typed. Businesses already carry coordinates, so rather than
 * add a geocoding API key (and a per-search network hop, and a rate limit, and a
 * bill) we derive ZIP centroids from the data we already store — the mean of the
 * coordinates of every approved business in that ZIP.
 *
 * The trade-off is explicit: this only knows ZIPs where at least one provider has
 * coordinates. That is exactly the set of ZIPs where a radius search could return
 * anything, so the blind spot costs no results. When the ZIP is unknown, the
 * caller falls back to the old prefix match rather than returning nothing.
 */

const EARTH_RADIUS_MILES = 3958.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Great-circle distance in miles. */
export function haversineMiles(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Cached ZIP → centroid lookups.
 *
 * Centroids move only when a provider in that ZIP is added or edits their
 * address, so a short TTL is plenty and keeps a popular ZIP from re-querying on
 * every keystroke-triggered search. Bounded so a scripted sweep of every possible
 * ZIP cannot grow it without limit.
 */
const CENTROID_TTL_MS = 10 * 60_000;
const CENTROID_MAX_ENTRIES = 5_000;
const centroidCache = new Map<string, { value: Coordinates | null; expiresAt: number }>();

function readCache(zip: string): { hit: boolean; value: Coordinates | null } {
  const entry = centroidCache.get(zip);
  if (!entry) return { hit: false, value: null };
  if (entry.expiresAt <= Date.now()) {
    centroidCache.delete(zip);
    return { hit: false, value: null };
  }
  return { hit: true, value: entry.value };
}

function writeCache(zip: string, value: Coordinates | null) {
  if (centroidCache.size >= CENTROID_MAX_ENTRIES) {
    // Cheap eviction: drop the oldest insertion. Map preserves insertion order.
    const oldest = centroidCache.keys().next();
    if (!oldest.done) centroidCache.delete(oldest.value);
  }
  centroidCache.set(zip, { value, expiresAt: Date.now() + CENTROID_TTL_MS });
}

/**
 * Approximate centre of a ZIP code, averaged over the approved providers in it.
 *
 * Returns null when we hold no coordinates for that ZIP — the caller must treat
 * that as "cannot do proximity here", not as "nothing is nearby".
 */
export async function zipCentroid(zipCode: string): Promise<Coordinates | null> {
  const zip = zipCode.trim();
  if (!zip) return null;

  const cached = readCache(zip);
  if (cached.hit) return cached.value;

  try {
    // Only approved, active providers: an unapproved listing is invisible to
    // search, so letting it define where a ZIP *is* would skew the centre toward
    // somewhere the family can never see results.
    const rows = await prisma.business.findMany({
      where: {
        zipCode: zip,
        isActive: true,
        verificationStatus: 'APPROVED',
        latitude: { not: null },
        longitude: { not: null },
      },
      select: { latitude: true, longitude: true },
      take: 50,
    });

    if (rows.length === 0) {
      writeCache(zip, null);
      return null;
    }

    const centroid: Coordinates = {
      latitude: rows.reduce((sum, r) => sum + (r.latitude ?? 0), 0) / rows.length,
      longitude: rows.reduce((sum, r) => sum + (r.longitude ?? 0), 0) / rows.length,
    };
    writeCache(zip, centroid);
    return centroid;
  } catch (error) {
    // Proximity is an enhancement. If the lookup fails, the search still runs —
    // it just falls back to the ZIP prefix match.
    console.error('zipCentroid lookup failed:', error);
    return null;
  }
}

/**
 * Latitude/longitude bounds that fully contain a circle of `radiusMiles`.
 *
 * Used to push a cheap, index-friendly pre-filter into the database so we are not
 * loading every listing in the country to measure it in JS. The box is a superset
 * of the circle (corners are up to ~41% further than the radius), so an exact
 * Haversine pass still runs afterwards to trim the corners.
 */
export function boundingBox(centre: Coordinates, radiusMiles: number) {
  const latDelta = radiusMiles / 69; // ~69 miles per degree of latitude
  // Degrees of longitude shrink toward the poles. Clamp the cosine so a search
  // centred near a pole widens the box instead of dividing by ~0.
  const lonDegreeMiles = Math.max(0.1, Math.cos(toRad(centre.latitude)) * 69);
  const lonDelta = radiusMiles / lonDegreeMiles;

  return {
    minLat: centre.latitude - latDelta,
    maxLat: centre.latitude + latDelta,
    minLon: centre.longitude - lonDelta,
    maxLon: centre.longitude + lonDelta,
  };
}
