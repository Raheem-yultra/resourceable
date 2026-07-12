# ResourceAble Codebase Audit

Scope: full `app/`, `components/`, `lib/`, `services/`, `hooks/`, `prisma/schema.prisma`, `middleware.ts`. Verified against real tool output, not just inspection — `npx tsc --noEmit` and `npm run build` both currently pass clean on `main` (b6e96ea).

**Important context**: the codebase today is a **single-category** marketplace (`Business` → `Service`, tagged by `Disability`/`ServiceType`). The "seven category flows" and `Category`/`Listing` model described in the project brief do not exist in the schema yet — that structure is still only a planning document (`ResourceAble-Category-Expansion-Plan.md`). Findings below are scored against the app as it actually exists today; category-expansion work is out of scope for this audit.

---

## Summary table

| ID | File/Location | Issue | Severity | Fix |
|----|---|---|---|---|
| B-01 | `components/business/BusinessProfileForm.tsx` | Price range & age group `<select>`/checkbox values don't match the Prisma `PriceRange`/`AgeGroup` enums | **Blocker** | Use the real enum values as option values |
| H-01 | `components/business/BusinessProfileForm.tsx` | Disability/service-type checkboxes use hardcoded codes that don't match DB slugs | High | Fetch real options from `/api/disabilities` and `/api/service-types` |
| H-02 | `app/business/dashboard/page.tsx` | Dashboard stats are hardcoded to 0/"Pending", never reflect real data | High | Query real counts server-side |
| H-03 | `prisma/schema.prisma`, admin action routes | No audit trail model for admin actions | High | Add `AdminAction` model (see Pass 3 plan) |
| H-04 | `app/api/admin/businesses/[id]/suspend/route.ts` | Suspend overloads `rejectionReason`, no reversal path, no reviewer/timestamp recorded | High | Dedicated suspension fields + unsuspend endpoint |
| H-05 | `app/api/business/profile/route.ts` | Imports `businessProfileSchema` but never uses it; hand-rolled validation runs *after* a partial DB write | High | Validate with zod before any mutation |
| M-01 | `app/api/admin/businesses/[id]/remove`, `.../suspend` | Duplicate raw Resend client + duplicated HTML instead of reusing `lib/email.ts`; bypasses `businessService` used by the sibling `verify` route | Medium | Consolidate on `lib/email.ts` + `businessService` |
| M-02 | `app/api/admin/businesses/pending/route.ts` | `status` query param cast `as any`, not validated against `VerificationStatus` | Medium | Validate with zod enum |
| M-03 | `app/api/business/profile/route.ts` (GET) | No role check — any authenticated user can call it | Medium | Add `role !== 'BUSINESS'` check |
| M-04 | `app/messages/page.tsx:16` | Redirects to `/api/auth/signin` instead of the app's `/auth/signin` | Medium | Fix redirect path |
| M-05 | `app/api/business/profile/route.ts` (PUT) | N+1: loops calling `findUnique`+`create` per service type / disability | Medium | Batch with `findMany({slug:{in:[...]}})` + `createMany` |
| M-06 | `app/api/messages/route.ts` | Fetches entire message history into memory, paginates/groups in JS | Medium | Aggregate/paginate at the DB level |
| M-07 | `components/admin/ApprovedBusinessesManager.tsx` | Renders `service.price`, `location`, `availabilityHours`, `virtualOption`, `inPersonOption` — none exist on `Service` | Medium | Remove or wire to real fields |
| M-08 | `lib/email.ts`, admin routes | Hardcoded personal Gmail as `replyTo`; one occurrence is mistyped (`...2005@gmail.com` vs `...22005@gmail.com`) | Medium | Use an env-configured support address; fix typo |
| M-09 | `app/api/auth/verify-email/route.ts` (GET) | Verifying email is a side-effecting GET — link prefetchers can burn the token | Medium | Require a POST/confirm step, or tolerate re-verification |
| M-10 | `lib/auth.ts`, signup/forgot-password/contact routes | No rate limiting anywhere | Medium | Add basic throttling (e.g. Upstash/in-memory+IP) |
| M-11 | `components/search/ServiceList.tsx` | Favorite heart button is local-only state, not wired to the `Favorite` model | Medium | Wire to a real favorites API |
| L-01 | `components/business/BusinessProfile.tsx` | Fully unused, and stale relative to current `Service` shape | Low | Delete |
| L-02 | `services/message.service.ts` | Entirely unused; routes reimplement inline with a *different* unread mechanism (`status` enum vs. `readAt`) | Low | Delete service or migrate routes to use it consistently |
| L-03 | `services/business.service.ts#updateBusiness`, `services/service.service.ts#searchServices` | Unused / duplicated by inline logic elsewhere | Low | Delete or consolidate |
| L-04 | `components/search/SearchFilters.tsx` | Leftover `console.log` debug statements | Low | Remove |
| L-05 | `prisma/` | No `prisma/migrations` history; schema changes rely on ad-hoc SQL files + `db push` | Low | Note only — follow existing raw-SQL-file convention for new changes |
| L-06 | `app/auth/signin/page.tsx` vs `ContactModal.tsx` | Sign-in error banner lacks `role="alert"`, inconsistent with rest of app | Low | Add `role="alert"` |
| L-07 | `app/business/[id]/page.tsx`, `MessageInbox.tsx` | `<img>` for logos/avatars without dimensions (CLS) or `next/image` | Low | Add width/height or migrate to `next/image` |

**Not flagged (checked, found solid):** DB indexing on `Business`/`Service`/junction tables is already comprehensive for current query patterns. No `NEXT_PUBLIC_*` or client-side env var leaks found. No unjustified `"use client"` components found — all client components need hooks/interactivity they declare. No `@ts-ignore`/`@ts-nocheck`/`eslint-disable` suppressions in the codebase. TypeScript compiles clean; production build succeeds.

---

## Detailed findings

### B-01 — Enum mismatch causes save failures (Blocker)
`components/business/BusinessProfileForm.tsx` renders a price-range `<select>` with options `FREE / BUDGET / MODERATE / PREMIUM / LUXURY / CONTACT` and an age-group checkbox list including `SENIOR`. The real Prisma enums are:
- `PriceRange`: `FREE | LOW | MEDIUM | HIGH | PREMIUM | CONTACT`
- `AgeGroup`: `INFANT | TODDLER | CHILD | TEEN | ADULT | ALL_AGES`

`app/api/business/profile/route.ts` writes `body.priceRange` and `body.ageGroups` straight into `prisma.service.create/update` with no enum validation. Selecting `BUDGET`, `MODERATE`, `LUXURY`, or `SENIOR` (the majority of the options a business owner would naturally pick) throws a Prisma validation error at write time → the route's catch-all returns a generic 500, and the business profile silently fails to save. Only `FREE`, `PREMIUM`, and `CONTACT` happen to work.
**Fix:** change the form's option values to the real enum members (rename labels, not values), and add a zod schema that validates against `z.nativeEnum(PriceRange)` / `z.nativeEnum(AgeGroup)` server-side so a mismatch is a 400, not a 500.

### H-01 — Disability/service-type slugs don't match DB (High)
Same file defines hardcoded `DISABILITY_TYPES`/`SERVICE_TYPES` arrays with values like `'AUTISM'`, `'THERAPY'`. The seeded DB uses slugs like `'autism-spectrum-disorder'`, `'speech-therapy'` (see `/api/disabilities`, `/api/service-types`). `PUT /api/business/profile` looks up `prisma.disability.findUnique({ where: { slug } })` — this returns `null` for every hardcoded value, so the `if (serviceType)`/`if (disability)` guard silently no-ops. Businesses can check every box and nothing is ever saved; on reload, none of the checkboxes show as checked because the loaded DB slugs don't match the hardcoded constants either.
**Fix:** fetch disabilities/service types from the existing `/api/disabilities` and `/api/service-types` endpoints (already used correctly by `SearchFilters.tsx`) and bind checkboxes to real `slug`/`name`.

### H-02 — Fake dashboard stats (High)
`app/business/dashboard/page.tsx` renders "Total Services", "Messages", "Profile Views" hardcoded to `0`, and "Verification" hardcoded to `Pending`, regardless of the signed-in business's actual state. An approved business with 5 live services and unread messages still sees zeros and "Pending" — actively misleading.
**Fix:** query `service.count`, unread message count, `viewCount`, and real `verificationStatus` for the session's business server-side and render the real values.

### H-03 — No admin audit trail (High)
No model in `prisma/schema.prisma` records who approved/rejected/suspended/removed a business, or when, beyond the single `reviewedBy`/`reviewedAt`/`rejectionReason` fields on `Business` itself (which get overwritten on every subsequent action, destroying history). There is no way to answer "who suspended this business and why" after a second action occurs.
**Fix:** see Pass 3 — add an `AdminAction` model logging actor, target, action type, reason, and timestamp, written on every admin mutation.

### H-04 — Suspend has no accountability or reversal (High)
`app/api/admin/businesses/[id]/suspend/route.ts` sets `verificationStatus: 'REJECTED'` and stuffs `rejectionReason: 'SUSPENDED: ' + reason` — conflating "never approved" and "was approved, then suspended" into the same enum value and a string-prefix hack. It never sets `reviewedBy`/`reviewedAt`, so there's no record of which admin suspended the business. There is no unsuspend endpoint at all — the only way back to `APPROVED` is directly editing the DB.
**Fix:** see Pass 3 — add a proper `SUSPENDED` status (or a separate `isSuspended` flag so approval history isn't destroyed) and a reversal endpoint.

### H-05 — Validation bypassed, partial writes on error (High)
`app/api/business/profile/route.ts` imports `businessProfileSchema` from `lib/validations.ts` but never calls `.parse()`/`.safeParse()` on it — every other route in the app (`signup`, `contact`, `messages`, `services`) validates with zod first. This route hand-checks a few fields inline, and critically, **validates `capacity` after the business upsert has already run** (line ~115, after line ~73's `prisma.business.upsert`). If `capacity` is negative, the request 400s, but the business record has already been updated with the earlier (valid) fields — a partial write on a request that ultimately fails.
**Fix:** build one zod schema covering the whole payload (including `capacity`, `priceMin/Max`, enums per B-01), validate first, then perform all writes.

### M-01 — Duplicated email/admin logic (Medium)
`remove/route.ts` and `suspend/route.ts` each define their own `getResendClient()` and ~60 lines of inline HTML email template, duplicating what `lib/email.ts` already centralizes for every other transactional email. They also bypass `businessService` (used correctly by the sibling `verify/route.ts`) in favor of raw `prisma.business.update` calls. Three different patterns for what should be one code path.
**Fix:** add `sendBusinessRemovedEmail`/`sendBusinessSuspendedEmail` to `lib/email.ts`, and route both actions through `businessService`.

### M-02 — Unvalidated status filter (Medium)
`app/api/admin/businesses/pending/route.ts` reads `status` from the query string and passes it straight through as `status as any` to `businessService.getBusinessesByStatus`. Any string value is accepted, including ones that don't correspond to a valid Prisma enum.
**Fix:** `z.enum(['PENDING','APPROVED','REJECTED']).parse(status)` before use.

### M-03 — Missing role check (Medium)
`GET /api/business/profile` only checks `session?.user` — any authenticated `USER` or `ADMIN` can call it. It only returns the caller's own business record (`getBusinessByUserId(session.user.id)`), so the practical impact is a 404 for non-business users rather than data leakage, but it's inconsistent with the rest of the API's role checks and should fail fast with 403 instead.
**Fix:** add `session.user.role !== 'BUSINESS'` check alongside the existing session check.

### M-04 — Wrong sign-in redirect (Medium)
`app/messages/page.tsx:16` — `redirect('/api/auth/signin')` sends users to the NextAuth default page instead of the app's themed `/auth/signin`.
**Fix:** change to `redirect('/auth/signin')`.

### M-05 — N+1 in profile save (Medium)
Same PUT handler loops `for (const typeSlug of body.serviceTypes)` and `for (const disabilitySlug of body.disabilityTypes)`, issuing one `findUnique` + one `create` per item (after first deleting all existing mappings). For a form with a dozen checkboxes this is ~24+ round trips per save.
**Fix:** `prisma.serviceType.findMany({ where: { slug: { in: body.serviceTypes } } })` then `prisma.serviceTypeMap.createMany({ data: [...] })`; same for disabilities.

### M-06 — Unbounded in-memory message pagination (Medium)
`app/api/messages/route.ts`'s `getConversations()` helper fetches **every** message involving the user (no `take`/`skip` in the Prisma query), builds a JS `Map` grouped by partner, then applies `.slice(skip, skip + limit)` afterward. This works today but will degrade linearly with total message volume per user rather than staying bounded.
**Fix:** aggregate conversations at the DB level (e.g. a `Conversation`/`lastMessageAt` denormalization, or a raw SQL `DISTINCT ON` query), or at minimum cap the initial fetch with a reasonable `take`.

### M-07 — Admin UI shows fields that don't exist (Medium)
`components/admin/ApprovedBusinessesManager.tsx`'s `Service` interface and "View Listings" dialog reference `price`, `location`, `availabilityHours`, `virtualOption`, `inPersonOption` — none of these are fields on the Prisma `Service` model. They always render as `undefined`/"Not specified", making the admin listings view look incomplete or broken.
**Fix:** either add these fields to `Service` if the product intends them, or remove the dead UI branches.

### M-08 — Hardcoded personal email + typo (Medium)
Every transactional email (`lib/email.ts`, plus the duplicated templates in `remove`/`suspend` routes) sets `replyTo: 'raheemrehman22005@gmail.com'` — a hardcoded personal Gmail address baked into source, not an env var. Worse, `sendCustomerConfirmationEmail` in `lib/email.ts` has a typo: `replyTo: 'raheemrehman2005@gmail.com'` (missing a digit), so customer-confirmation replies go to a different, likely-nonexistent address than every other email.
**Fix:** introduce `SUPPORT_EMAIL` env var, use it everywhere, fix the typo.

### M-09 — Email verification is a side-effecting GET (Medium)
`GET /api/auth/verify-email` marks the account verified and invalidates the token as a side effect of a plain link click. Email security scanners and corporate link-prefetchers that "click" links before delivery can burn the token before the real user opens the email, permanently breaking their verification flow (`Invalid or expired verification token` on the user's real click).
**Fix:** either make verification idempotent/safe to repeat (don't null out the token on first hit — null it after a short grace window or leave it and rely on `emailVerified` alone), or interpose a confirmation click (page renders "Click to verify" → POSTs).

### M-10 — No rate limiting (Medium)
None of `signup`, `forgot-password`, `contact`, or the NextAuth credentials `authorize()` throttle repeated attempts. Combined with the enumeration-safe responses (good practice already in place), this is still a brute-force/spam surface.
**Fix:** add basic IP/account-based throttling (e.g. a small in-memory or Redis-backed limiter) on these routes.

### M-11 — Non-functional favorite button (Medium)
`components/search/ServiceList.tsx`'s `ServiceCard` has a heart/favorite toggle backed only by `useState(false)` — it never calls an API, never persists, and resets on reload/re-render, despite a `Favorite` model existing in the schema with routes nowhere else in the app either. Users who click it reasonably believe it worked.
**Fix:** either wire it to a real `/api/favorites` endpoint or remove the affordance until built.

### Low-severity items
- **L-01** `components/business/BusinessProfile.tsx` — dead component, not rendered anywhere (`app/business/[id]/page.tsx` inlines its own cards instead); also references a `Service` shape (`serviceTypes: string[]`, `disabilityTypes: string[]`) that no longer matches reality. Delete.
- **L-02** `services/message.service.ts` — dead; `app/api/messages/route.ts` and `app/api/messages/[userId]/route.ts` reimplement the same conversation/read-tracking logic inline, and the inline version tracks "read" via the `status` enum while the unused service tracks it via `readAt` — two divergent mechanisms for the same concept even though the `Message` model has both fields. Pick one and delete the other code path.
- **L-03** `services/business.service.ts#updateBusiness` and `services/service.service.ts#searchServices` — unused; the profile route does a raw `prisma.business.upsert` instead, and `/api/search` has its own more-featured inline `searchServices`. Delete the dead versions to avoid future confusion about which is canonical.
- **L-04** `components/search/SearchFilters.tsx` — leftover `console.log('Disabilities response status...')` / `console.log('Service types data...')` debug statements. Remove.
- **L-05** No `prisma/migrations/` directory — the project relies on `prisma db push` plus hand-written SQL files (`add-email-verification.sql`, `supabase_migrations_init.sql`). Not a bug, but means Pass 2/3 schema changes should ship as a new SQL file in that same convention rather than assuming `prisma migrate` history exists.
- **L-06** `app/auth/signin/page.tsx` error banner (`theme-danger` div) has no `role="alert"`/`aria-live`, unlike the equivalent banner in `ContactModal.tsx`. Screen reader users get no notification of a failed sign-in. Add `role="alert"`.
- **L-07** `<img>` tags for business logos (`app/business/[id]/page.tsx`) and avatars (`MessageInbox.tsx`) have no explicit width/height, risking layout shift, and don't use `next/image`. Low priority since these are user-uploaded/external URLs (would need `next.config.js` domain config), but worth a follow-up.

---

## Pass 1 conclusion

No blockers exist in the *compiled* code (`tsc`/`build` both clean) — the one Blocker (B-01) is a runtime data bug invisible to the type checker because form payloads are untyped JSON. Highest-value fixes for Pass 2 are B-01, H-01, H-02, H-05 (all real, user-facing breakage), followed by the admin accountability gaps (H-03, H-04) which Pass 3 needs as a foundation anyway.
