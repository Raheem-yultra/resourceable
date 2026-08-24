/**
 * The provider setup spine — one canonical description of what a business has to
 * do, in order, before families can find them.
 *
 * It lives here (not in a component) because three surfaces have to agree on it:
 * the dashboard checklist, the header on each setup page, and the "what's next"
 * CTA. When they disagree, providers stall — the most common reason an
 * application sits half-finished in the admin queue.
 *
 * The division of labour it encodes is the important part:
 *   - a BUSINESS is who you are — name, address, contact, credentials. One of these.
 *   - a LISTING is something you offer — a service, therapy, product, program, or
 *     event. As many as you like, each independently browsable and reviewable.
 * These are stored separately (Business vs. Service) and are edited separately.
 */

export type StepStatus = 'complete' | 'current' | 'todo' | 'blocked' | 'waiting';

export interface SetupStep {
  id: 'details' | 'listings' | 'review';
  title: string;
  /** One line telling the provider what this step is for. */
  description: string;
  status: StepStatus;
  /** What the provider should read right now, given the current state. */
  statusLabel: string;
  href: string;
  ctaLabel: string;
  /** False when the provider cannot act on this step yet (e.g. awaiting review). */
  actionable: boolean;
}

/** The Business fields that must be filled in before an admin can review an application. */
export const REQUIRED_DETAIL_FIELDS = [
  'businessName',
  'description',
  'phone',
  'email',
  'address',
  'city',
  'state',
  'zipCode',
] as const;

export type RequiredDetailField = (typeof REQUIRED_DETAIL_FIELDS)[number];

/**
 * Fields that are optional to save but are what we actually *verify* against
 * independent sources (NPPES, the Census address file, DNS/RDAP). Supplying more
 * of them is the difference between a fast approval and a manual investigation,
 * so the form says so and the checklist counts them.
 */
export const VERIFICATION_SIGNAL_FIELDS = ['npi', 'website', 'licenseNumber', 'yearEstablished'] as const;

export interface BusinessSetupInput {
  businessName?: string | null;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  npi?: string | null;
  website?: string | null;
  licenseNumber?: string | null;
  yearEstablished?: number | null;
  verificationStatus?: string | null;
}

const filled = (v: unknown) => typeof v === 'number' || (typeof v === 'string' && v.trim().length > 0);

/** Which required detail fields are still empty. Empty array means step 1 is done. */
export function missingDetailFields(business: BusinessSetupInput | null): RequiredDetailField[] {
  if (!business) return [...REQUIRED_DETAIL_FIELDS];
  return REQUIRED_DETAIL_FIELDS.filter((f) => {
    // A one-word description is technically "filled" but useless to a family, so
    // hold it to the same minimum the form and the server schema enforce.
    if (f === 'description') return (business.description ?? '').trim().length < 10;
    return !filled(business[f]);
  });
}

/** How many independent-source signals the provider has supplied (0-4). */
export function verificationSignalCount(business: BusinessSetupInput | null): number {
  if (!business) return 0;
  return VERIFICATION_SIGNAL_FIELDS.filter((f) => filled(business[f])).length;
}

export function detailsComplete(business: BusinessSetupInput | null): boolean {
  return missingDetailFields(business).length === 0;
}

/**
 * Build the three-step checklist for a provider.
 *
 * `listingCount` is passed in rather than read off the business row because every
 * caller already has it from its own query; a second round-trip here would be
 * wasted work on each dashboard render.
 */
export function buildSetupSteps(business: BusinessSetupInput | null, listingCount: number): SetupStep[] {
  const missing = missingDetailFields(business);
  const isDetailsDone = missing.length === 0;
  const hasListings = listingCount > 0;
  const status = business?.verificationStatus ?? 'PENDING';
  const isApproved = status === 'APPROVED';
  const isRejected = status === 'REJECTED';

  const details: SetupStep = {
    id: 'details',
    title: 'Add your business details',
    description: 'Who you are, where you are, how families reach you, and the credentials we verify.',
    status: isDetailsDone ? 'complete' : 'current',
    statusLabel: isDetailsDone
      ? 'Complete'
      : `${missing.length} required field${missing.length === 1 ? '' : 's'} left`,
    href: '/business/profile',
    ctaLabel: isDetailsDone ? 'Edit details' : 'Continue',
    actionable: true,
  };

  const listings: SetupStep = {
    id: 'listings',
    title: 'Create your listings',
    description: 'One listing for each service, therapy, product, program, or event you offer.',
    status: hasListings ? 'complete' : isDetailsDone ? 'current' : 'todo',
    statusLabel: hasListings ? `${listingCount} listing${listingCount === 1 ? '' : 's'}` : 'None yet',
    href: '/business/listings',
    ctaLabel: hasListings ? 'Manage listings' : 'Add your first listing',
    actionable: true,
  };

  const review: SetupStep = {
    id: 'review',
    title: 'We review your application',
    description: 'Our team checks your details against public registries before you go live.',
    status: isApproved
      ? 'complete'
      : isRejected
        ? 'blocked'
        : isDetailsDone && hasListings
          ? 'waiting'
          : 'todo',
    statusLabel: isApproved
      ? 'Approved — your listings are live'
      : isRejected
        ? 'Not approved — check your email'
        : isDetailsDone && hasListings
          ? 'In review'
          : 'Starts once the steps above are done',
    href: '/business/profile',
    ctaLabel: 'Review your details',
    actionable: !isApproved,
  };

  return [details, listings, review];
}

/** The one step the provider should act on next, or null when nothing is pending. */
export function nextActionableStep(steps: SetupStep[]): SetupStep | null {
  return steps.find((s) => s.status === 'current') ?? null;
}

/** Days of the week, in the order the hours editor and the public page show them. */
export const WEEK_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type WeekDay = (typeof WEEK_DAYS)[number];
