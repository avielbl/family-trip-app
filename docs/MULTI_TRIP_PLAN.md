# Multi-Trip Support — Analysis & Implementation Plan

## 1. Current-State Analysis

### What already works in our favor

The Firestore data layer is **already multi-trip shaped**. Every entity lives under
`trips/{tripCode}/...` and every function in `src/firebase/tripService.ts` takes a
`tripCode` parameter:

```
trips/{tripCode}                    # TripConfig
trips/{tripCode}/days|flights|hotels|driving|rentalCars|
                 highlights|restaurants|packing|photos|
                 quizAnswers|travelLog
users/{uid}                         # UserProfile
```

Storage paths are also namespaced (`trips/{tripCode}/photos/{id}`), and
`TripContext` re-subscribes to all collections whenever `tripCode` changes
(`src/context/TripContext.tsx:138-168`). Two trips can already coexist in the
database without conflict — the app just has no UI or state model to manage
more than one.

### Single-trip assumptions that block multi-trip

| # | Assumption | Where |
|---|-----------|-------|
| A1 | One `tripCode` per device in `localStorage`, no trip list, no switcher | `TripContext.tsx:71-73`, `SettingsPage` |
| A2 | No "family" entity — nothing shared across trips (members, active trip) | whole codebase |
| A3 | `UserProfile.tripCode` is singular | `types/trip.ts:25` |
| A4 | Setup/create/join flow only reachable when **no** trip is joined | `App.tsx:39-47` |
| A5 | Trip dates hardcoded to Greece 2026 on create (`2026-03-24` / `2026-04-04`) — the wizard has **no date inputs** | `SetupPage.tsx:53-54` |
| A6 | Claude ticket-parsing prompt hardcodes "Trip starts March 24, 2026 … dayIndex 11" | `SetupPage.tsx:143-145` |
| A7 | Ticket/confirmation upload only exists inside first-time setup; can't import into an existing trip later | `SetupPage.tsx` (`mode === 'upload'`) |
| A8 | Greece-specific content: app title, countdown strings, 🇬🇷 emoji, passport page, quiz questions, travel-log prompt, restaurant map query | `i18n/en.ts`, `i18n/he.ts`, `App.tsx:34`, `PassportPage.tsx`, `QuizPage.tsx` (hardcoded question bank), `TravelLogPage.tsx:55`, `RestaurantsPage.tsx:44` |
| A9 | `currentMember` / `virtualMember` stored globally in localStorage — member IDs are per-trip, so switching trips would carry a stale member | `TripContext.tsx:92-119`, `AuthContext.tsx:38-44` |
| A10 | Date fallbacks default to Greece dates when config missing | `TripContext.tsx:174-175` |
| A11 | Firestore rules have no concept of a trip registry or family; trip-config write rule allows any authed user to overwrite a trip with no `adminUid` | `firestore.rules:17-24` |

---

## 2. Target Design

### 2.1 Data model changes

**New top-level collection: `families/{familyId}`** — the shared "home" that
outlives any single trip and answers *"which trip is the family on right now?"*

```typescript
export interface Family {
  id: string;                 // auto-id or slug
  name: string;               // "The Blumenfelds"
  adminUids: string[];        // family admins (replaces global ADMIN_EMAIL)
  memberTemplates: FamilyMember[]; // canonical member roster, copied into new trips
  tripCodes: string[];        // all trips, newest first
  activeTripCode: string | null;  // THE family-wide active trip
  createdAt: string;
}
```

**`TripConfig` additions** (`src/types/trip.ts`):

```typescript
export interface TripConfig {
  tripCode: string;
  tripName: string;
  familyId: string;           // NEW — back-reference
  destination: string;        // NEW — "Greece"
  destinationHe?: string;     // NEW
  countryCode?: string;       // NEW — "GR" (map queries, flag)
  flagEmoji: string;          // NEW — "🇬🇷" (replaces hardcoded emoji)
  startDate: string;
  endDate: string;
  familyMembers: FamilyMember[]; // per-trip snapshot (participants can differ)
  adminUid?: string;
  status: 'draft' | 'upcoming' | 'active' | 'archived'; // NEW
  createdAt: string;          // NEW
}
```

**`UserProfile` change**: `tripCode?: string` → `familyId?: string` +
`lastViewedTripCode?: string` (personal preference; family active trip is the default).

**Per-trip quiz questions**: move the hardcoded Greece bank out of
`QuizPage.tsx` into `trips/{tripCode}/quizQuestions/{id}` (the `QuizQuestion`
type already exists in `types/trip.ts`). Seed via admin UI (manual + optional
Claude generation, same pattern as the travel log).

**Design decisions:**

- **Family members are copied into each trip, not referenced.** Grandma may join
  one trip; a kid's emoji may change. `Family.memberTemplates` is the prefill
  source; each trip's roster stays independent. This exactly matches today's
  data shape, so **no data migration for existing trip content**.
- **`activeTripCode` on the family doc is the single source of truth** for "the
  family's current trip". Every device subscribes to the family doc, so when the
  admin flips the active trip, all devices switch in real time. A user can still
  temporarily browse another (e.g. past) trip; that choice is device-local and
  clearly indicated in the UI.
- **Old trips are never deleted** — archiving is just `status: 'archived'` +
  removal from the active slot. All photos, quiz scores, travel log, ratings
  remain browsable read-only forever.

### 2.2 Client state

```
AuthProvider
  └─ FamilyProvider          (NEW: family doc subscription, myTrips summaries)
       └─ TripProvider        (current tripCode → all existing subscriptions)
            └─ AppRoutes
```

**New `FamilyContext`** (`src/context/FamilyContext.tsx`):

- Subscribes to `families/{familyId}` (found via `users/{uid}.familyId`, or via
  legacy `tripCode` during migration).
- Exposes: `family`, `trips: TripSummary[]` (code, name, flag, dates, status),
  `activeTripCode`, `setActiveTripForFamily(code)` (admin-only),
  `browseTrip(code)` / `returnToActiveTrip()` (device-local override),
  `createTrip(...)`, `archiveTrip(code)`.

**`TripContext` changes:**

- `tripCode` is now *derived*: `deviceOverrideTripCode ?? family.activeTripCode`.
  The existing `localStorage['tripCode']` becomes the override slot only.
- `isViewingActiveTrip: boolean` and `isReadOnlyView` (browsing an archived trip
  as non-admin) exposed for the UI.
- **Fix A9**: key member persistence per trip —
  `localStorage['currentMember:{tripCode}']` and
  `localStorage['virtualMember:{tripCode}']`. Email-matched members re-resolve
  automatically per trip (that logic already runs on config load).
- **Fix A10**: drop the Greece date fallbacks; render nothing date-dependent
  until config loads.

### 2.3 New/changed UI

**New `TripsPage` (`/trips`)** — the trip manager:

- Cards for every trip in the family: flag emoji, name, dates, status badge
  (Active ✈️ / Upcoming / Past), member count.
- Tap a card → browse that trip (device-local). Banner appears: *"Viewing
  Rome 2027 — family active trip is Greece 2026 [Return]"*.
- Admin-only per-card actions: **Set as family active trip**, Archive, Delete (draft only).
- **"+ New Trip"** button → create wizard.

**Create-Trip wizard** — refactor `SetupPage` into reusable steps, reachable both
from first-run and from `/trips/new` inside the app:

1. **Trip details**: code, name, destination, flag emoji, **start/end date
   pickers** (fixes A5).
2. **Family members**: prefilled from `family.memberTemplates` (or the most
   recent trip on first migration); add/remove/edit per-trip.
3. **Import bookings** (optional, skippable): the existing Claude-powered
   flight-ticket/hotel-confirmation upload, with the prompt built from the
   *actual* trip dates (fixes A6):
   `Trip starts {startDate} (dayIndex 0) and ends {endDate} (dayIndex {n}).`
4. **Review & create**: writes `TripConfig`, appends to `family.tripCodes`,
   optionally sets it active immediately.

**New `ImportPage` (`/import`, admin-only)** — the same upload/parse/review step
extracted as a standalone page so tickets and confirmations can be loaded into the
**current trip at any time**, not just during setup (fixes A7). `importTripData`
already merges by document ID, so incremental imports are safe.

**`Layout` header**: show `config.flagEmoji + config.tripName` with a chevron →
opens the trip switcher (route to `/trips`). Replaces the static app title.

**`SettingsPage` / `AdminPage`**: add "Manage trips" link; Admin page gains
trip status controls and quiz-question management.

**Routing (`App.tsx`)**: the "no trip" gate becomes a "no family" gate. First run
= create family (implicit with first trip) or join via invite link.
`/join/:tripCode` keeps working and now also attaches the user to the trip's
`familyId`.

### 2.4 De-Greecing content (fixes A8)

| Item | Change |
|------|--------|
| App title / countdown strings | i18n interpolation: `t('home.countdown', { days, destination })`; strings become "X days until {{destination}}!" |
| Loading / setup / join flag emoji | `config.flagEmoji` (fallback ✈️) |
| `PassportPage` | emblem, subtitle, date range from config |
| `QuizPage` | reads `trips/{code}/quizQuestions` (see 2.1); Greece bank becomes the seed data for the existing trip |
| `TravelLogPage` prompt | interpolate `config.tripName` / `config.destination` |
| `RestaurantsPage` map query | use `config.destination` instead of literal "Greece" |
| `SetupPage` defaults | empty trip name, no hardcoded dates |

### 2.5 Firestore security rules

```
match /families/{familyId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth.uid in resource.data.adminUids
             || <membership-limited fields via request.resource diff>;
}
match /trips/{tripCode} { ... existing, plus:
  allow create: if request.auth != null;      // explicit create (new trip)
  allow update, delete: if isAdmin(tripCode) || isFamilyAdmin(resource.data.familyId);
}
```

Key hardening while we're here (A11): split `create` from `update` on trip
config so an existing trip without `adminUid` can't be hijacked; family admins
can administer all family trips (replaces the hardcoded
`ADMIN_EMAIL` check in `AuthContext.tsx:12` — keep the email as a bootstrap
fallback during migration, then remove).

### 2.6 Migration of the existing Greece trip

Lazy, client-side, idempotent — no script needed:

1. On sign-in, if `users/{uid}.familyId` is missing but a legacy
   `tripCode` exists (profile or localStorage) → load that trip config.
2. If the trip has no `familyId`: create `families/{autoId}` with
   `adminUids: [trip.adminUid]`, `memberTemplates: trip.familyMembers`,
   `tripCodes: [tripCode]`, `activeTripCode: tripCode`; stamp `familyId`,
   `status: 'active'`, `flagEmoji: '🇬🇷'`, `destination: 'Greece'` onto the trip
   (admin device performs the write; other devices wait/retry).
3. Set `users/{uid}.familyId`. Done — the Greece trip is trip #1 of the family.
4. One-time seed of the Greece quiz bank into `quizQuestions` (admin device).

---

## 3. Implementation Phases

### Phase 1 — Data model & migration foundation (no visible UI change)
- [ ] `types/trip.ts`: add `Family`, extend `TripConfig` (all new fields optional at first), update `UserProfile`.
- [ ] `firebase/familyService.ts`: CRUD + `subscribeFamily`, `setActiveTrip`, `addTripToFamily`, trip-summary fetcher (`getDoc` per code — family trip counts are tiny).
- [ ] Lazy migration routine (2.6) invoked from `AuthContext`/`FamilyProvider`.
- [ ] `firestore.rules`: families collection + create/update split; deploy.

### Phase 2 — Contexts & trip switching
- [ ] New `FamilyContext`; insert provider between Auth and Trip.
- [ ] `TripContext`: derive tripCode from family active + device override; per-trip member persistence keys (A9); remove date fallbacks (A10).
- [ ] `AuthContext`: `isAdmin` from `family.adminUids` (email fallback during migration).

### Phase 3 — Trip manager UI
- [ ] `TripsPage` (`/trips`): trip cards, active-trip control, browse/return, archive.
- [ ] Layout header trip switcher + "viewing non-active trip" banner.
- [ ] Read-only guard for archived trips (hide edit/upload FABs for non-admins).

### Phase 4 — Create-trip wizard & booking import
- [ ] Refactor `SetupPage` → `components/tripWizard/` steps; add date pickers, destination/flag fields, member prefill from templates.
- [ ] Dynamic dayIndex prompt for Claude parsing (A6); route `/trips/new`.
- [ ] Standalone `ImportPage` (`/import`) for loading flight tickets/hotel confirmations into the current trip anytime (A7).
- [ ] `/join/:tripCode` attaches `familyId`.

### Phase 5 — Content generalization
- [ ] i18n interpolation for destination strings; config-driven emoji/title everywhere (A8 table).
- [ ] Quiz questions from Firestore + admin editor + Greece seed.
- [ ] Travel-log & restaurant-map destination interpolation.

### Phase 6 — AI provider abstraction (multi-model support)

Today the app calls the Anthropic Messages API directly from the browser in two
places, with duplicated fetch code:

- `SetupPage.tsx:119` — booking-confirmation parsing (images → JSON). **Pinned
  to `claude-sonnet-4-20250514`, a deprecated model past its announced
  retirement date — this call is at risk of breaking regardless of any other
  change and must be updated first.**
- `TravelLogPage.tsx:64` — travel-log entry generation (uses `claude-sonnet-4-6`).

Planned quiz-question generation (Phase 5) adds a third call site — the right
moment to introduce an abstraction.

**Design: `src/ai/` provider layer**

```
src/ai/
  types.ts        // AiProvider interface: parseBookings(images, tripCtx),
                  // generateTravelLog(prompt), generateQuiz(destination, days)
  anthropic.ts    // Claude implementation
  gemini.ts       // Google Gemini implementation (REST generateContent API)
  index.ts        // getProvider(settings) factory
```

- All three tasks are the same shape (multimodal input → text/JSON out), so one
  small interface covers them; each implementation is ~80 lines of fetch code.
- **Settings UI**: provider picker (Claude / Gemini) + per-provider API key +
  model dropdown, stored per device (localStorage, as today). Admin-only section.
- JSON extraction should use each provider's native structured-output support
  where available; keep the manual-edit textarea as the fallback.

**Pricing snapshot (July 2026)** — the app's calls are small (a few images +
~4K output), so absolute costs are cents either way; this mostly informs the
default choice:

| Model | Input $/1M | Output $/1M | Notes |
|---|---|---|---|
| Claude Haiku 4.5 | $1.00 | $5.00 | Cheapest Claude; fine for log/quiz text |
| Gemini 3.5 Flash-Lite | $0.30 | $2.50 | Cheapest overall |
| Gemini 3.6 Flash | $1.50 | $7.50 | Good vision; ticket parsing |
| Gemini 3.1 Pro | $2.00 | $12.00 | |
| Claude Sonnet 5 | $3.00 ($2 intro to 2026-08-31) | $15.00 ($10 intro) | Best extraction quality |
| Claude Opus 5 | $5.00 | $25.00 | Overkill here |

Recommended defaults: ticket parsing → Claude Sonnet 5 or Gemini 3.6 Flash
(vision quality matters most here); travel log & quiz → Claude Haiku 4.5 or
Gemini 3.5 Flash-Lite. Note Gemini "Flash" is not automatically cheaper than
every Claude option — Haiku 4.5 undercuts Gemini 3.6 Flash; the real savings
are in the Flash-Lite tier.

**Security note (should be part of this phase):** API keys currently live in
localStorage and calls go browser-direct (`anthropic-dangerous-direct-browser-access`).
The cleaner long-term shape is a **Firebase Cloud Function** (`parseBookings`,
`generateContent`) holding the keys server-side, callable only by trip admins.
This also makes provider switching invisible to clients and removes the
key-entry step from the wizard. Recommended, but can ship after the client-side
abstraction if we want to keep the no-backend simplicity for now.

- [ ] Replace deprecated `claude-sonnet-4-20250514` in SetupPage with `claude-sonnet-5` (do immediately, independent of the rest)
- [ ] Extract `src/ai/` provider interface; move both existing call sites onto it
- [ ] Add Gemini implementation + provider/model/key settings UI
- [ ] (Recommended) Move AI calls into a Cloud Function with server-held keys

### Phase 7 — Polish & hardening
- [ ] Remove `ADMIN_EMAIL` bootstrap once family admins are stamped.
- [ ] Empty states (family with zero trips), delete-draft-trip flow.
- [ ] QA pass: two concurrent trips, switch active mid-use on two devices, archived-trip browsing, fresh-device join link, PWA offline behavior after switching.

**Suggested order of PRs:** Phase 1+2 together (invisible foundation), then 3, then 4, then 5, then 6, then 7. Each phase leaves the app fully working for the current Greece trip. (The deprecated-model fix at the top of Phase 6 should ship immediately, ahead of everything else.)

---

## Known bug: "regenerate routes — hotels changed" notification on every open

**Finding: this notification does not come from this repository.** A full-text
search of the working tree *and every commit in git history* finds no
"regenerate", "routes changed", or hotels-changed notification code (English or
Hebrew), no toast/banner component, and no logic comparing hotels against
driving segments. `DrivingPage` renders static segments; the PWA is configured
with `registerType: 'autoUpdate'` (silent updates, no prompt).

Most likely explanations, in order:

1. **The deployed build differs from this repo** — uncommitted local code (or a
   different branch) was deployed to Firebase Hosting. If that code has a
   "hotels changed since routes were generated" check, the classic bug that
   makes it fire on every open is treating the *initial* Firestore
   `onSnapshot` emission as a change: with offline persistence enabled
   (`firebase/config.ts`), every app open delivers a cached snapshot followed
   by a server snapshot, and `docChanges()` on the first emission lists every
   hotel as "added". A staleness flag persisted in localStorage that is set on
   any snapshot and never cleared would behave exactly as described —
   "hotels changed" months after the last real edit.
2. **The notification belongs to another app entirely** (e.g. Google Maps
   suggesting route updates) and coincides with opening this one.

**To resolve:** capture the exact notification text/screenshot and check
whether the deployed bundle contains it
(`curl -s https://<app-host>/assets/index-*.js | grep -o 'regenerate[^"]*'`).
If it's in the deployed bundle, the deployed code isn't in this repo — recover
it from the deploying machine, commit it, and apply the first-snapshot fix
(ignore `docChanges()` on the initial emission, or compare a stored
`hotelsUpdatedAt` timestamp rather than snapshot deltas).

---

## 4. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Migration race (two devices create the family doc) | Only the admin device performs migration; others poll for `trip.familyId`. |
| Stale member selection after switching trips (A9) | Per-trip localStorage keys + auto re-match by email; virtual picker re-prompts on unknown member. |
| Rules deploy vs. old clients | New fields optional; rules keep `request.auth != null` reads; deploy rules before shipping the client. |
| Firestore subscription churn on rapid switching | Existing effect teardown on `tripCode` change already handles this; debounce switcher taps. |
| Claude prompt drift for long trips | dayIndex computed from real dates; cap prompt to trip length; keep manual JSON edit step as today. |
