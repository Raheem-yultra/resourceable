# ResourceAble — Category Expansion & Marketplace Planning Document

**Version:** 1.0
**Date:** July 2026
**Scope:** Restructuring browse/search from a single generic "services" model into a multi-category, third-party marketplace with trust/verification built in.

---

## 1. Overview & Rationale

ResourceAble currently treats all listings as a single generic "Service" type. As the platform grows, listings fall into meaningfully different categories with different attributes, pricing models, and time-sensitivity. Forcing them into one schema and one search/filter UI creates confusion for users and friction for providers.

This document splits listings into **7 top-level categories**, defines subcategories, and lays out the data model, navigation, filtering, and trust/safety systems needed to support all of them — with the key constraint that **every listing is posted by a third-party provider**, not the platform itself.

---

## 2. Category Taxonomy

### 2.1 Two Fundamentally Different Content Types

**A. Bookable / Business Listings** — has a provider, location, and (usually) a price:
- Services, Therapies, Shop, School, Events

**B. Informational Content** — no provider or transaction, purely knowledge-based:
- Resources

Resources should **not** share a search index or filter bar with the other five. It behaves more like a knowledge base (searchable by topic/tag) than a location-based marketplace search.

### 2.2 Top-Level Categories & Subcategories

| Category | Subcategories | Time-bound? | Pricing model | Has provider? |
|---|---|---|---|---|
| **Services** | Barber, Dentist, General Practitioner, Optometrist, Salon/Grooming, Pediatrician, Nutritionist, Home Health Aide | No | Per-visit | Yes |
| **Therapies** | Speech Therapy, Occupational Therapy, ABA Therapy, Physical Therapy, Behavioral/Counseling, Music Therapy, Art Therapy, Feeding Therapy | No | Per-session/package | Yes |
| **Shop** | Mobility Aids, Sensory Tools, Communication Devices (AAC), Adaptive Clothing, Adaptive Furniture, Safety Equipment, Toys & Learning Aids | No | One-time / Rent | Yes |
| **School** | Special Education Schools, Inclusive/Mainstream Programs, Tutoring & Learning Support, Transition/Life Skills Programs, Vocational Training, Early Intervention Programs | No (enrollment-based) | Tuition/Free | Yes |
| **Events** | Support Groups, Workshops/Training, Camps, Fundraisers, Social/Recreational Meetups, IEP/Advocacy Clinics | Yes — has a date | Free/Ticketed | Yes |
| **Resources** | Benefits & Legal Rights, Financial Assistance, Education Rights (IEP/504), Daily Living Guides, Crisis/Hotline Directory, Insurance Navigation | No | Free | No |

### 2.3 "21+" — Cross-Cutting Filter, Not a Category

"21+" (adult/transition-age, post-IDEA-eligibility) is treated as an **age-range attribute**, not a standalone listing type, to avoid duplicate listings and provider confusion about where to post.

- Applied as a tag/filter: `ageGroup: ["0-5", "6-12", "13-20", "21+"]`
- Applies across Services, Therapies, School, and Events
- Gets a dedicated landing page (`/browse/21-plus`) that pre-filters everything tagged 21+ across all applicable types — giving it a dedicated presence without a duplicate content model

---

## 3. Data Model

```
Category (shared lookup table — not hardcoded enums, to allow future growth)
- id
- listingType (SERVICE | THERAPY | SHOP | SCHOOL | EVENT)
- name
- parentCategoryId (nullable — supports sub-subcategories later)

Listing (shared table/view — powers unified search across bookable types)
- id
- type (SERVICE | THERAPY | SHOP | SCHOOL | EVENT)
- categoryId, subcategoryId
- title, description
- ageGroups[] (0-5, 6-12, 13-20, 21+)
- location, isVirtualAvailable
- price, priceType (per-visit / per-session / package / one-time / rent / free)
- businessId (FK → Business — required; no platform-owned listings)
- verificationLevel (UNVERIFIED | BASIC_VERIFIED | LICENSED)
- createdAt, updatedAt

# Type-specific extension fields
Service/Therapy → deliveryMode (in-person/virtual/both), insuranceAccepted[]
Shop            → condition (new/used-like-new/used-fair), isForRent, brand, images[]
School          → enrollmentStatus, gradeLevel[], programType
Event           → startDate, endDate, capacity, rsvpCount, isVirtual

Resource (separate table — not part of the Listing search index)
- id, title, body, topicTags[], resourceType (article/guide/hotline/form), externalUrl

Review (shared across all listing types)
- id, listingId, userId, rating, comment, createdAt

Report/Flag (shared across all listing types)
- id, listingId, reportedBy, reason, status
```

**Why a `Category` lookup table instead of hardcoded enums:** subcategories will keep expanding as the platform grows — a lookup table avoids schema migrations every time a new subcategory is added.

**Why a shared `Listing` table/view:** enables one fast unified search across Services/Therapies/Shop/School/Events instead of querying five tables separately every time someone searches "wheelchair" or "speech."

---

## 4. Third-Party Trust & Verification System

Since every listing is posted by a third party, trust infrastructure needs to be foundational, not bolted on later.

- **Verification gates every listing**, not just business profiles. No listing goes live until its business is APPROVED.
- **Type-specific verification requirements:**
  - Therapies → license/certification number
  - School → accreditation info
  - Events (especially those involving minors) → organizer verification
  - Shop / Services → lighter-weight (lower liability)
- **Tiered trust levels** rather than a binary verified/unverified: `UNVERIFIED`, `BASIC_VERIFIED`, `LICENSED` — shown as a badge on every listing card.
- **Reviews & ratings** — one shared review system across all listing types, surfaced on cards and detail pages.
- **Reporting/flagging** — available on every listing from launch; not optional given the vulnerable population served.
- **Search ranking** should weight verification + rating alongside distance, so a trusted provider isn't outranked purely on proximity.
- **Liability disclaimer** — clear "ResourceAble does not directly provide or endorse..." language in the footer and on listing detail pages. *(Recommend legal review given the population served — this is not legal advice.)*

---

## 5. Navigation & Information Architecture

A flat 7-item nav is too cluttered. Recommended grouping:

```
Nav: Browse ▾        School        Events        Resources
        ├ Services
        ├ Therapies
        └ Shop
```

- **Browse** dropdown/mega-menu groups Services, Therapies, and Shop — the three "find a provider/product" flows people naturally bounce between (e.g. "wheelchair" could mean a Shop item or a Therapy-related mobility assessment).
- **School** and **Events** stay top-level — conceptually distinct (enrollment-based vs. date-based).
- **Resources** stays top-level but visually distinct (different icon/treatment) since it's not a location-based search at all.

### URL Structure
```
/browse                    → unified search, type toggle defaults to "All"
/browse/services
/browse/therapies
/browse/shop
/browse/school
/browse/events
/browse/21-plus            → pre-filtered cross-category view
/resources                 → separate search/browse experience (topic-based)
```

---

## 6. Filters Per Category

| Filter | Services | Therapies | Shop | School | Events |
|---|---|---|---|---|---|
| Category/subcategory | ✅ | ✅ | ✅ | ✅ | ✅ |
| Age group (incl. 21+) | ✅ | ✅ | — | ✅ | ✅ |
| Distance/location | ✅ | ✅ | ✅ | ✅ | ✅ (skip if virtual) |
| Price range | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delivery/format (in-person/virtual) | ✅ | ✅ | Delivery vs. pickup | — | ✅ |
| Insurance accepted | — | ✅ | — | — | — |
| Date/date range | — | — | — | Enrollment period | ✅ (primary filter) |
| Condition (new/used) | — | — | ✅ | — | — |
| Verification level | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rating | ✅ | ✅ | ✅ | ✅ | ✅ |

**Resources** filters instead by topic tag (Benefits & Legal, Daily Living, Education Rights, Financial Assistance, Crisis/Hotlines, Insurance Navigation) — no distance/price/verification filters apply.

### Filter UX Rules
- Primary filters always visible: **Category, Distance, Price**
- Everything else lives behind a "More filters" disclosure
- Subcategory filter should be a **searchable multi-select**, not a long checkbox list (8+ subcategories per type)
- Location/radius is set once and persists across all category tabs — only type-specific filters reset on tab switch
- Mobile: use a bottom-sheet filter drawer, with an active-filter-count badge on the "Filters" button

---

## 7. UX Risks & Design Guardrails

1. **Type-blindness in global search** — e.g. "wheelchair" should surface Shop items AND relevant Therapy listings with clear type badges, not force users to guess the right tab.
2. **Filter state loss on tab switch** — location/radius should persist; only type-specific filters reset.
3. **Zero-result dead ends** — always offer relaxed suggestions (widen radius, related category) instead of a blank page.
4. **Mobile filter overload** — bottom-sheet drawer over a full sidebar; keep primary filters minimal.
5. **Card design must instantly convey type + trust** — type icon/badge, verification badge, rating, and type-specific secondary info line (e.g. Shop: price + condition; Therapies: price/session + delivery mode; Events: date + spots remaining; School: enrollment status).
6. **Accessibility is a core requirement, not a nice-to-have** — large touch targets, high contrast, clear focus states, screen-reader-friendly filters, given the target audience.
7. **Provider-side complexity** — a single "Add Listing" entry point with a type picker up front, rather than five buried, separate forms. Onboarding should ask "What do you offer?" (multi-select) so each business's dashboard only shows relevant listing forms.
8. **Location handling** — request location once (geolocation + manual fallback), reuse across all categories; don't re-prompt per tab.
9. **Liability/trust visibility** — verification badge and disclaimer language must be visible at the point of decision (listing card and detail page), not buried in a terms page.

---

## 8. Open Questions / Decisions Needed

- [ ] Confirm "21+" refers to adult/transition-age services (post-IDEA eligibility) — adjust if a different meaning was intended.
- [ ] Define exact verification requirements per category (what documentation is required for LICENSED status in Therapies vs. School vs. Events).
- [ ] Decide whether Shop items are always third-party-fulfilled, or whether some platform-facilitated fulfillment (e.g. shipping/escrow) is in scope.
- [ ] Legal review of liability/disclaimer language before launch.
- [ ] Decide on review moderation policy (pre-moderated vs. post-moderated, and flagging thresholds for auto-hiding a listing).

---

## 9. Suggested Build Order

1. `Category` lookup table + migrate existing `Service` data into new `Listing` shape
2. Verification level system on `Business` + `Listing` (gate before anything else ships)
3. Unified `Listing` search/index + `/browse` with type tabs
4. Category-specific extension fields (Shop, School, Event) + their forms
5. Filters (primary bar + "more filters" drawer) per category
6. Review + Report/Flag system (shared components)
7. Resources as a separate content system
8. `/browse/21-plus` cross-category landing page
