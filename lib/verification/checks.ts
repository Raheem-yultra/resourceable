// The individual pre-approval checks. Each one answers a single question about a
// provider application and returns evidence — never a decision. Approval stays manual;
// these exist so an admin adjudicates exceptions instead of investigating every row.
//
// The governing rule: NEVER verify by reading what the provider typed. Verify by
// matching it against a source the provider does not control (NPPES, the Census
// address file, DNS/RDAP, or our own database).
//
// Result semantics — the whole system depends on keeping these apart:
//   PASS    corroborated by an independent source
//   WARN    unusual or unverifiable; a human should look
//   FAIL    contradicted by an authoritative source
//   SKIPPED the provider supplied nothing to check
//   ERROR   the external source was unreachable — says nothing about the provider

import { prisma } from '@/lib/prisma';
import {
  domainExists,
  domainRegisteredAt,
  geocodeAddress,
  hostnameOf,
  isReservedDomain,
  isValidNpiFormat,
  lookupNpi,
  registrableDomain,
  siteResponds,
  type GeocodeMatch,
  type NppesRecord,
} from './providers';

export type CheckResult = 'PASS' | 'WARN' | 'FAIL' | 'SKIPPED' | 'ERROR';

export type CheckType = 'EMAIL_DOMAIN' | 'WEBSITE' | 'PHONE' | 'ADDRESS' | 'DUPLICATE' | 'NPI';

export interface CheckOutcome {
  type: CheckType;
  result: CheckResult;
  /** One-line verdict rendered verbatim in the admin queue. */
  summary: string;
  details?: Record<string, unknown>;
  /** Coordinates recovered as a side effect of ADDRESS, so we can backfill lat/lng. */
  geocode?: GeocodeMatch;
}

/** Everything a check needs, flattened so checks stay independent of Prisma shapes. */
export interface BusinessSnapshot {
  id: string;
  businessName: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  npi: string | null;
  /** The login address — proves control only because signup requires verification. */
  accountEmail: string;
  accountEmailVerified: boolean;
}

/** Consumer mailbox providers — legitimate for a sole practitioner, weak as evidence. */
const FREEMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'rocketmail.com',
  'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'aol.com', 'icloud.com',
  'me.com', 'mac.com', 'protonmail.com', 'proton.me', 'gmx.com', 'mail.com',
  'yandex.com', 'zoho.com', 'fastmail.com', 'hushmail.com', 'comcast.net',
  'verizon.net', 'att.net', 'sbcglobal.net', 'bellsouth.net', 'cox.net',
  'example.com', 'example.org', 'example.net', 'example.test',
]);

const wrap = (type: CheckType, result: CheckResult, summary: string, details?: Record<string, unknown>): CheckOutcome =>
  ({ type, result, summary, details });

/** Any thrown error becomes ERROR, so one dead endpoint can't fail an application. */
async function guard(type: CheckType, run: () => Promise<CheckOutcome>): Promise<CheckOutcome> {
  try {
    return await run();
  } catch (error: any) {
    return wrap(type, 'ERROR', `Could not complete check: ${error?.message || 'unknown error'}`);
  }
}

// ---------------------------------------------------------------------------
// 1. EMAIL_DOMAIN — does the applicant control the business's own domain?
// ---------------------------------------------------------------------------
// The strongest cheap signal we have. The account email is verified at signup, so an
// address ON the business domain proves the applicant controls a mailbox there.

export function checkEmailDomain(b: BusinessSnapshot): CheckOutcome {
  const siteDomain = b.website ? registrableDomain(b.website) : null;
  const accountDomain = registrableDomain(`x@${b.accountEmail.split('@')[1] ?? ''}`);
  const contactDomain = b.email ? registrableDomain(`x@${b.email.split('@')[1] ?? ''}`) : null;
  const details = { siteDomain, accountDomain, contactDomain, accountEmailVerified: b.accountEmailVerified };

  if (!siteDomain) {
    if (accountDomain && !FREEMAIL_DOMAINS.has(accountDomain)) {
      return wrap('EMAIL_DOMAIN', 'WARN', `Custom domain (${accountDomain}) but no website listed to match it against`, details);
    }
    return wrap('EMAIL_DOMAIN', 'WARN', 'Consumer email address and no website — nothing to corroborate', details);
  }

  // A documentation/test domain can't corroborate anything, however well it matches.
  if (isReservedDomain(siteDomain)) {
    return wrap('EMAIL_DOMAIN', 'WARN', `Website uses the reserved domain ${siteDomain} — cannot corroborate the email`, details);
  }

  const matches = accountDomain === siteDomain || contactDomain === siteDomain;
  if (matches && b.accountEmailVerified && accountDomain === siteDomain) {
    return wrap('EMAIL_DOMAIN', 'PASS', `Verified account email is on the business domain (${siteDomain})`, details);
  }
  if (matches) {
    return wrap('EMAIL_DOMAIN', 'PASS', `Contact email is on the business domain (${siteDomain})`, details);
  }
  if (accountDomain && FREEMAIL_DOMAINS.has(accountDomain)) {
    return wrap('EMAIL_DOMAIN', 'WARN', `Consumer email (${accountDomain}) does not match the website domain (${siteDomain})`, details);
  }
  return wrap('EMAIL_DOMAIN', 'WARN', `Email domain (${accountDomain}) differs from the website domain (${siteDomain})`, details);
}

// ---------------------------------------------------------------------------
// 2. WEBSITE — does the domain exist, serve a site, and have some history?
// ---------------------------------------------------------------------------

const YOUNG_DOMAIN_DAYS = 90;

export async function checkWebsite(b: BusinessSnapshot): Promise<CheckOutcome> {
  return guard('WEBSITE', async () => {
    if (!b.website?.trim()) {
      return wrap('WEBSITE', 'SKIPPED', 'No website provided');
    }
    const host = hostnameOf(b.website);
    const domain = registrableDomain(b.website);
    if (!host || !domain) {
      return wrap('WEBSITE', 'FAIL', `"${b.website}" is not a parseable web address`);
    }
    // RFC 2606 reserves these for documentation — no real provider is served from one.
    if (isReservedDomain(domain)) {
      return wrap('WEBSITE', 'WARN', `${host} is a reserved example domain, not a real website`, { host, domain });
    }

    // Reachability first. DNS is consulted only when the site is unreachable, purely to
    // tell "this domain does not exist" (FAIL) from "we couldn't reach it" (WARN) — a
    // blocked or broken resolver must never be reported as evidence against a provider.
    const live = await siteResponds(host);

    // RDAP is the flakiest of the three sources; never let it fail the check.
    let registeredAt: Date | null = null;
    let ageDays: number | null = null;
    try {
      registeredAt = await domainRegisteredAt(domain);
      if (registeredAt) ageDays = Math.floor((Date.now() - registeredAt.getTime()) / 86_400_000);
    } catch {
      // registration date stays unknown
    }

    const details: Record<string, unknown> = {
      host, domain, httpStatus: live.status, registeredAt: registeredAt?.toISOString() ?? null, ageDays,
    };

    if (!live.ok) {
      const exists = await domainExists(host);
      details.dns = exists;
      if (exists === 'NO') {
        return wrap('WEBSITE', 'FAIL', `${host} does not exist — no DNS record for this domain`, details);
      }
      // RDAP knowing the domain proves it is at least registered, even if nothing serves it.
      if (exists === 'UNKNOWN' && !registeredAt) {
        return wrap('WEBSITE', 'WARN', `Could not reach ${host} and could not confirm it exists — verify manually`, details);
      }
      return wrap('WEBSITE', 'WARN', `${host} is registered but nothing is being served at it`, details);
    }
    if (ageDays != null && ageDays < YOUNG_DOMAIN_DAYS) {
      return wrap('WEBSITE', 'WARN', `Site is live but the domain is only ${ageDays} days old`, details);
    }
    if (ageDays == null) {
      return wrap('WEBSITE', 'PASS', `${host} is live (registration date not published)`, details);
    }
    return wrap('WEBSITE', 'PASS', `${host} is live; domain registered ${Math.floor(ageDays / 365)}y ago`, details);
  });
}

// ---------------------------------------------------------------------------
// 3. PHONE — plausibility only
// ---------------------------------------------------------------------------
// NOTE: this is deliberately NOT proof of ownership. Proving the applicant answers
// the listed number needs an OTP call/SMS, which needs an SMS provider (Twilio et al.)
// that this project has no credentials for — see DEPLOYMENT.md. Until then the only
// third-party corroboration available is the phone NPPES has on file for the NPI,
// which is why `nppesPhone` is threaded in from the NPI check.

const digitsOnly = (value: string) => value.replace(/\D/g, '');

/** Strips a US country code and returns the 10 NANP digits, or null. */
export function normalizePhone(value: string | null): string | null {
  if (!value) return null;
  let digits = digitsOnly(value);
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  return digits.length === 10 ? digits : null;
}

export function checkPhone(b: BusinessSnapshot, nppesPhone?: string | null): CheckOutcome {
  if (!b.phone?.trim()) {
    return wrap('PHONE', 'SKIPPED', 'No phone number provided');
  }
  const digits = normalizePhone(b.phone);
  if (!digits) {
    return wrap('PHONE', 'FAIL', `"${b.phone}" is not a valid 10-digit US number`);
  }
  const areaCode = digits.slice(0, 3);
  const exchange = digits.slice(3, 6);
  const details: Record<string, unknown> = { normalized: digits, areaCode };

  // NANP rules: area code and exchange both start 2-9.
  if (!/^[2-9]\d{2}$/.test(areaCode) || !/^[2-9]\d{2}$/.test(exchange)) {
    return wrap('PHONE', 'FAIL', `${b.phone} is not a dialable US number (invalid area code or exchange)`, details);
  }
  // 555-0100..0199 is the reserved fictional range.
  if (exchange === '555' && Number(digits.slice(6)) <= 199) {
    return wrap('PHONE', 'FAIL', `${b.phone} is in the reserved fictional 555 range`, details);
  }
  if (/^(\d)\1{9}$/.test(digits)) {
    return wrap('PHONE', 'FAIL', `${b.phone} is a placeholder (all identical digits)`, details);
  }

  // The one genuine ownership signal available without an SMS provider.
  const registryDigits = normalizePhone(nppesPhone ?? null);
  if (registryDigits) {
    details.nppesPhone = registryDigits;
    if (registryDigits === digits) {
      return wrap('PHONE', 'PASS', 'Matches the phone number registered to this NPI in NPPES', details);
    }
    return wrap('PHONE', 'WARN', `Valid number, but NPPES lists a different phone for this NPI (${registryDigits})`, details);
  }

  return wrap('PHONE', 'PASS', 'Valid US number — format only; ownership not verified (no SMS OTP configured)', details);
}

// ---------------------------------------------------------------------------
// 4. ADDRESS — does this street address exist?
// ---------------------------------------------------------------------------

const PO_BOX = /\b(p\.?\s*o\.?\s*box|post\s+office\s+box)\b/i;

export async function checkAddress(b: BusinessSnapshot): Promise<CheckOutcome> {
  return guard('ADDRESS', async () => {
    const street = b.address?.trim();
    if (!street || !(b.city?.trim() || b.zipCode?.trim())) {
      return wrap('ADDRESS', 'SKIPPED', 'No street address provided');
    }
    if (PO_BOX.test(street)) {
      return wrap('ADDRESS', 'WARN', 'PO Box — families cannot visit a mailbox; confirm a physical service location', { street });
    }

    const oneLine = [street, b.city, b.state, b.zipCode].filter(Boolean).join(', ');
    const match = await geocodeAddress(oneLine);
    if (!match) {
      return wrap('ADDRESS', 'WARN', 'Address could not be matched by the US Census geocoder', { submitted: oneLine });
    }

    const details = { submitted: oneLine, matched: match.matchedAddress, zip: match.zip, state: match.state };
    // A geocode hit on a different ZIP usually means a typo, occasionally a fabrication.
    if (b.zipCode && match.zip && digitsOnly(b.zipCode).slice(0, 5) !== match.zip.slice(0, 5)) {
      return {
        ...wrap('ADDRESS', 'WARN', `Address resolves, but to ZIP ${match.zip} rather than the submitted ${b.zipCode}`, details),
        geocode: match,
      };
    }
    return { ...wrap('ADDRESS', 'PASS', `Verified real address: ${match.matchedAddress}`, details), geocode: match };
  });
}

// ---------------------------------------------------------------------------
// 5. DUPLICATE — is this a re-registration of an existing provider?
// ---------------------------------------------------------------------------
// Catches a rejected or suspended provider signing up again under a new login.

export async function checkDuplicate(b: BusinessSnapshot): Promise<CheckOutcome> {
  return guard('DUPLICATE', async () => {
    const phoneDigits = normalizePhone(b.phone);
    const rawDomain = b.website ? registrableDomain(b.website) : null;
    // Shared reserved domains (example.com et al.) are not evidence of a shared owner.
    const domain = rawDomain && !isReservedDomain(rawDomain) ? rawDomain : null;
    const zip = b.zipCode ? digitsOnly(b.zipCode).slice(0, 5) : null;

    const filters: any[] = [];
    if (b.npi) filters.push({ npi: b.npi });
    if (domain) filters.push({ website: { contains: domain, mode: 'insensitive' } });
    if (zip) filters.push({ zipCode: { startsWith: zip } });
    if (phoneDigits) filters.push({ phone: { contains: phoneDigits } });
    filters.push({ businessName: { equals: b.businessName, mode: 'insensitive' } });

    // Bounded candidate fetch (indexed on zipCode), then exact comparison in JS —
    // stored phones/addresses are free-text, so SQL equality alone would miss
    // "(415) 555-0134" vs "415-555-0134".
    const candidates = await prisma.business.findMany({
      where: { id: { not: b.id }, OR: filters },
      select: {
        id: true, businessName: true, npi: true, phone: true, website: true,
        address: true, zipCode: true, verificationStatus: true, isSuspended: true,
      },
      take: 200,
    });

    const normalizeText = (v: string | null) => (v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const matches = candidates
      .map((c) => {
        const on: string[] = [];
        if (b.npi && c.npi && c.npi === b.npi) on.push('NPI');
        if (phoneDigits && normalizePhone(c.phone) === phoneDigits) on.push('phone');
        if (domain && c.website && registrableDomain(c.website) === domain) on.push('website');
        if (
          b.address && c.address && zip && c.zipCode &&
          normalizeText(c.address) === normalizeText(b.address) &&
          digitsOnly(c.zipCode).slice(0, 5) === zip
        ) on.push('address');
        if (normalizeText(c.businessName) === normalizeText(b.businessName)) on.push('name');
        return { id: c.id, businessName: c.businessName, verificationStatus: c.verificationStatus, isSuspended: c.isSuspended, matchedOn: on };
      })
      .filter((m) => m.matchedOn.length > 0);

    if (matches.length === 0) {
      return wrap('DUPLICATE', 'PASS', 'No existing provider shares this NPI, phone, domain, address, or name');
    }

    // A collision with a provider we already rejected or suspended is the case this
    // check exists for — surface it as FAIL so it can't be waved through.
    const blocked = matches.find((m) => m.verificationStatus === 'REJECTED' || m.isSuspended);
    if (blocked) {
      return wrap(
        'DUPLICATE',
        'FAIL',
        `Matches ${blocked.isSuspended ? 'a suspended' : 'a previously rejected'} provider "${blocked.businessName}" on ${blocked.matchedOn.join(', ')}`,
        { matches }
      );
    }
    const strong = matches.find((m) => m.matchedOn.some((o) => o === 'NPI' || o === 'phone'));
    if (strong) {
      return wrap('DUPLICATE', 'FAIL', `Shares ${strong.matchedOn.join(' and ')} with existing provider "${strong.businessName}"`, { matches });
    }
    return wrap('DUPLICATE', 'WARN', `Overlaps ${matches.length} existing provider(s) on ${matches[0].matchedOn.join(', ')}`, { matches });
  });
}

// ---------------------------------------------------------------------------
// 6. NPI — the authoritative check
// ---------------------------------------------------------------------------
// Anyone who genuinely bills insurance has an NPI, and NPPES is public, free, and
// maintained by CMS. Matching name + location against it is the single strongest
// routine signal available to this platform.

/** Corporate noise that shouldn't count for or against a name match. */
const NAME_NOISE = new Set([
  'inc', 'incorporated', 'llc', 'llp', 'lp', 'pllc', 'pc', 'pa', 'corp', 'corporation',
  'co', 'company', 'ltd', 'limited', 'the', 'and', 'of', 'dba', 'group', 'services',
  'service', 'center', 'centre', 'clinic', 'therapy', 'therapies', 'health', 'healthcare',
]);

function nameTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !NAME_NOISE.has(t));
}

/** Overlap of the distinctive tokens, 0..1. Tolerates DBA/suffix differences. */
export function nameSimilarity(a: string, b: string): number {
  const left = new Set(nameTokens(a));
  const right = new Set(nameTokens(b));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  left.forEach((token) => { if (right.has(token)) shared++; });
  return shared / Math.min(left.size, right.size);
}

const STRONG_NAME_MATCH = 0.6;

function nppesDisplayName(record: NppesRecord): string {
  const basic = record.basic ?? {};
  if (basic.organization_name) return basic.organization_name;
  return [basic.first_name, basic.last_name].filter(Boolean).join(' ');
}

export interface NpiCheckOutcome extends CheckOutcome {
  /** Phone NPPES holds for this NPI — the only free corroboration of the phone. */
  nppesPhone?: string | null;
}

export async function checkNpi(b: BusinessSnapshot): Promise<NpiCheckOutcome> {
  const outcome = await guard('NPI', async () => {
    const npi = b.npi?.trim();
    if (!npi) {
      return wrap('NPI', 'SKIPPED', 'No NPI provided — required for the LICENSED tier');
    }
    if (!isValidNpiFormat(npi)) {
      return wrap('NPI', 'FAIL', `${npi} is not a valid NPI (fails the CMS check digit)`, { npi });
    }

    const record = await lookupNpi(npi);
    if (!record) {
      return wrap('NPI', 'FAIL', `${npi} does not exist in the NPPES registry`, { npi });
    }

    const registryName = nppesDisplayName(record);
    const location = record.addresses?.find((a) => a.address_purpose === 'LOCATION') ?? record.addresses?.[0];
    const taxonomy = record.taxonomies?.find((t) => t.primary) ?? record.taxonomies?.[0];
    const similarity = nameSimilarity(b.businessName, registryName);
    const details: Record<string, unknown> = {
      npi,
      registryName,
      enumerationType: record.enumeration_type,
      status: record.basic?.status,
      enumerationDate: record.basic?.enumeration_date,
      specialty: taxonomy?.desc,
      taxonomyLicense: taxonomy?.license,
      taxonomyState: taxonomy?.state,
      registryAddress: location ? [location.address_1, location.city, location.state, location.postal_code].filter(Boolean).join(', ') : null,
      registryPhone: location?.telephone_number ?? null,
      nameSimilarity: Number(similarity.toFixed(2)),
    };

    if (record.basic?.status && record.basic.status !== 'A') {
      return wrap('NPI', 'FAIL', `NPPES record for ${npi} is deactivated (status ${record.basic.status})`, details);
    }

    const stateMatches = !b.state || !location?.state || b.state.trim().toUpperCase() === location.state.toUpperCase();
    if (similarity >= STRONG_NAME_MATCH && stateMatches) {
      return wrap('NPI', 'PASS', `Active NPPES record matches "${registryName}"${taxonomy?.desc ? ` — ${taxonomy.desc}` : ''}`, details);
    }
    if (similarity >= STRONG_NAME_MATCH) {
      return wrap('NPI', 'WARN', `Name matches, but NPPES lists this NPI in ${location?.state} rather than ${b.state}`, details);
    }
    return wrap('NPI', 'WARN', `NPI is active but registered to "${registryName}" — confirm this is the same entity (possible DBA)`, details);
  });

  const registryPhone = (outcome.details?.registryPhone as string | undefined) ?? null;
  return { ...outcome, nppesPhone: registryPhone };
}
