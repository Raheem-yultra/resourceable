// External data sources used by the pre-approval checks (lib/verification/checks.ts).
//
// Every source here is FREE, PUBLIC and KEYLESS by design — no vendor contract, no
// secret to rotate, nothing to configure at deploy time:
//   - NPPES  (CMS National Provider Identifier registry)  — is this a real provider?
//   - US Census geocoder                                   — is this a real address?
//   - RDAP   (the IETF successor to WHOIS)                 — how old is this domain?
//
// All of them are best-effort: an outage must surface as ERROR ("we couldn't check")
// and never as FAIL ("this provider is fraudulent"). Callers rely on that distinction.

import { promises as dns } from 'dns';

/** Per-request ceiling. Checks run in parallel, so this also bounds the whole run. */
const TIMEOUT_MS = 5_000;

/** Identifies us to public APIs — several ask for a contactable UA string. */
const USER_AGENT = 'ResourceAble/1.0 (provider verification; +https://resourceable.vercel.app)';

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { 'user-agent': USER_AGENT, ...(init.headers || {}) },
      // These are public reference datasets; never let Next cache a verification result.
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = TIMEOUT_MS): Promise<T> {
  const res = await fetchWithTimeout(url, init, timeoutMs);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------

// Multi-label public suffixes common enough to matter here. This is deliberately a
// short list rather than the full Public Suffix List — the directory is US-focused,
// and getting these wrong only affects domain-equality precision, never a FAIL.
const TWO_PART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'org.au',
  'co.nz', 'co.za', 'com.br', 'co.in', 'co.jp',
]);

/** Bare hostname from a URL or an already-bare host. Returns null if unparseable. */
export function hostnameOf(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    return url.hostname.toLowerCase().replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

/** "mail.brightpath.co.uk" -> "brightpath.co.uk". Used to compare email vs website. */
export function registrableDomain(input: string): string | null {
  const host = hostnameOf(input);
  if (!host) return null;
  const parts = host.split('.');
  if (parts.length < 2) return null;
  const lastTwo = parts.slice(-2).join('.');
  if (parts.length > 2 && TWO_PART_SUFFIXES.has(lastTwo)) {
    return parts.slice(-3).join('.');
  }
  return lastTwo;
}

// Domains RFC 2606 / RFC 6761 reserve for documentation and testing. Nothing here can
// ever be a real business website, so they must never count as corroboration — and
// because every seeded demo provider shares example.com, matching on them would also
// produce enormous false "duplicate provider" results.
const RESERVED_DOMAINS = new Set(['example.com', 'example.net', 'example.org', 'example.edu']);
const RESERVED_TLDS = ['.test', '.example', '.invalid', '.localhost', '.local'];

export function isReservedDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  return RESERVED_DOMAINS.has(d) || RESERVED_TLDS.some((tld) => d.endsWith(tld));
}

/**
 * Does this domain exist in DNS?
 *
 * Three-valued ON PURPOSE. A resolver that is blocked or unreachable (ECONNREFUSED,
 * ESERVFAIL, common in sandboxes and locked-down networks) must return UNKNOWN, never
 * NO — otherwise a local network problem would be reported to an admin as evidence
 * that a legitimate provider's domain is fake.
 */
export type DomainExistence = 'YES' | 'NO' | 'UNKNOWN';

export async function domainExists(host: string): Promise<DomainExistence> {
  let sawNotFound = false;
  for (const lookup of [dns.resolve4, dns.resolve6, dns.resolveMx] as const) {
    try {
      const records = await lookup(host);
      if (records.length > 0) return 'YES';
    } catch (error: any) {
      const code = error?.code;
      if (code === 'ENOTFOUND' || code === 'NXDOMAIN') {
        sawNotFound = true; // authoritative "no such name" — keep checking other types
      } else if (code === 'ENODATA') {
        continue; // domain exists, just not this record type
      } else {
        return 'UNKNOWN'; // resolver itself is unavailable
      }
    }
  }
  return sawNotFound ? 'NO' : 'UNKNOWN';
}

/**
 * Is something actually served at this hostname? Follows redirects.
 * Bounded to three attempts so one hanging server can't dominate a check run.
 */
export async function siteResponds(host: string): Promise<{ ok: boolean; status?: number; errorCode?: string }> {
  const attempts: Array<[string, string]> = [
    ['https', 'HEAD'],
    ['https', 'GET'], // some servers reject HEAD outright
    ['http', 'GET'], // last resort: http-only sites still exist
  ];
  let errorCode: string | undefined;
  for (const [scheme, method] of attempts) {
    try {
      const res = await fetchWithTimeout(`${scheme}://${host}`, { method, redirect: 'follow' }, 4_000);
      // 4xx/5xx still proves a server is there; only treat 404-on-root as not-live.
      if (res.status < 500 && res.status !== 404) return { ok: true, status: res.status };
    } catch (error: any) {
      errorCode = error?.cause?.code || error?.code || errorCode;
    }
  }
  return { ok: false, errorCode };
}

interface RdapResponse {
  events?: Array<{ eventAction?: string; eventDate?: string }>;
}

/**
 * Domain registration date via RDAP. Returns null when the registry doesn't publish
 * it (common for some ccTLDs) — callers must treat null as "unknown", not "new".
 */
export async function domainRegisteredAt(domain: string): Promise<Date | null> {
  const data = await fetchJson<RdapResponse>(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
    headers: { accept: 'application/rdap+json' },
    redirect: 'follow',
  });
  const event = data.events?.find((e) => e.eventAction === 'registration');
  if (!event?.eventDate) return null;
  const date = new Date(event.eventDate);
  return isNaN(date.getTime()) ? null : date;
}

// ---------------------------------------------------------------------------
// US Census geocoder — validates that a street address actually exists
// ---------------------------------------------------------------------------

export interface GeocodeMatch {
  matchedAddress: string;
  latitude: number;
  longitude: number;
  zip?: string;
  state?: string;
  city?: string;
}

interface CensusResponse {
  result?: {
    addressMatches?: Array<{
      matchedAddress?: string;
      coordinates?: { x?: number; y?: number };
      addressComponents?: { zip?: string; state?: string; city?: string };
    }>;
  };
}

export async function geocodeAddress(oneLineAddress: string): Promise<GeocodeMatch | null> {
  const url =
    'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress' +
    `?address=${encodeURIComponent(oneLineAddress)}&benchmark=Public_AR_Current&format=json`;
  // Census typically answers in ~1-2s but is the slowest of the three sources, so it
  // gets a slightly longer leash than the default — capped at 7s because these checks
  // run inline on the provider's save and must finish inside a serverless timeout.
  const data = await fetchJson<CensusResponse>(url, {}, 7_000);
  const match = data.result?.addressMatches?.[0];
  if (!match?.coordinates || match.coordinates.x == null || match.coordinates.y == null) {
    return null;
  }
  return {
    matchedAddress: match.matchedAddress ?? oneLineAddress,
    // Census returns x = longitude, y = latitude.
    longitude: match.coordinates.x,
    latitude: match.coordinates.y,
    zip: match.addressComponents?.zip,
    state: match.addressComponents?.state,
    city: match.addressComponents?.city,
  };
}

// ---------------------------------------------------------------------------
// NPPES — the CMS National Provider Identifier registry
// ---------------------------------------------------------------------------

export interface NppesAddress {
  address_purpose?: string; // 'LOCATION' | 'MAILING'
  address_1?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  telephone_number?: string;
}

export interface NppesRecord {
  number?: string;
  enumeration_type?: string; // 'NPI-1' (individual) | 'NPI-2' (organization)
  basic?: {
    organization_name?: string;
    first_name?: string;
    last_name?: string;
    status?: string; // 'A' = active
    enumeration_date?: string;
    last_updated?: string;
  };
  addresses?: NppesAddress[];
  taxonomies?: Array<{ code?: string; desc?: string; primary?: boolean; state?: string; license?: string }>;
}

interface NppesResponse {
  result_count?: number;
  results?: NppesRecord[];
  Errors?: Array<{ description?: string }>;
}

/** Looks up one NPI by number. Returns null when the registry has no such record. */
export async function lookupNpi(npi: string): Promise<NppesRecord | null> {
  const data = await fetchJson<NppesResponse>(
    `https://npiregistry.cms.hhs.gov/api/?version=2.1&number=${encodeURIComponent(npi)}`
  );
  if (!data.result_count || !data.results?.length) return null;
  return data.results[0];
}

/**
 * NPI check digit (CMS spec): Luhn over the number prefixed with 80840.
 * Catches typos and invented numbers before we spend a network round-trip.
 */
export function isValidNpiFormat(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;
  const digits = `80840${npi.slice(0, 9)}`;
  let sum = 0;
  // Walk right-to-left, doubling every second digit.
  for (let i = digits.length - 1, position = 0; i >= 0; i--, position++) {
    let value = Number(digits[i]);
    if (position % 2 === 0) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(npi[9]);
}
