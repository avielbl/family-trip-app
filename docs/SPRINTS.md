# Multi-Trip Implementation — Sprint Plan

Execution model: each track runs as an independent dev agent in an isolated git
worktree on its own branch (`agent/<track>`). The integrator (scrum master)
merges tracks into `claude/multi-trip-app-plan-aykv9c` at the end of each
sprint and resolves conflicts. Only the integration branch is pushed.

File ownership is exclusive per track within a sprint — no two agents touch the
same file. Shared surfaces (`App.tsx` routes, `index.css` additions, i18n keys)
are owned as noted below or handled at integration.

## Sprint 1 — Foundation (2 parallel tracks)

### Track A — `agent/foundation`: data model, contexts, rules
Owns: `src/types/trip.ts`, `src/firebase/familyService.ts`,
`src/firebase/tripService.ts`, `src/firebase/authService.ts`,
`src/context/*.tsx`, `src/App.tsx` (provider wiring only), `firestore.rules`.

- Family/TripSummary types + TripConfig extensions (already scaffolded)
- `FamilyContext` (family subscription, trip summaries, setActiveTrip,
  registerTrip, archiveTrip, lazy legacy migration)
- `TripContext` rework: tripCode = device override ?? family.activeTripCode ??
  legacy localStorage; per-trip member persistence; member-id validation
  against the current trip's roster; `totalDays`; `quizQuestions` subscription;
  `browseTrip`/`returnToActiveTrip`; no Greece date fallbacks
- `isAdmin` = family.adminUids ∪ trip.adminUid ∪ legacy email bootstrap
- Firestore rules: `families` collection; trip create/update split; family
  admins administer family trips; `quizQuestions` subcollection

### Track B — `agent/ai`: AI provider layer
Owns: `src/ai/*`, `src/pages/TravelLogPage.tsx`, `src/pages/SettingsPage.tsx`
(AI section), `src/pages/SetupPage.tsx` (handleParse body only).

- `src/ai/` provider interface + Anthropic + Gemini implementations
- Settings: provider picker, model, API key (per-provider, localStorage,
  legacy `claudeApiKey` migration)
- Replace deprecated `claude-sonnet-4-20250514`; move both call sites onto the
  layer; `buildBookingPrompt(startDate, endDate)` for dynamic trip dates

## Sprint 2 — Features (3 parallel tracks, after Sprint 1 merge)

### Track C — `agent/trips-ui`: trip manager
Owns: `src/pages/TripsPage.tsx`, `src/components/Layout.tsx`.

- TripsPage: cards (flag, name, dates, status, members), set family active
  trip (admin), browse/return, archive, "+ New Trip" entry
- Layout: header shows `flagEmoji tripName` → navigates to `/trips`; banner
  when viewing a non-active trip

### Track D — `agent/wizard`: create-trip wizard & booking import
Owns: `src/pages/SetupPage.tsx`, `src/components/BookingImport.tsx`,
`src/pages/ImportPage.tsx`, `src/pages/JoinPage.tsx`.

- SetupPage → stepped wizard: details (code, name, destination, flag, real
  date pickers) → members (prefilled from family templates) → import → done;
  reachable at `/trips/new` from inside the app
- Trip creation: config with familyId/status/createdAt, generated TripDay
  stubs, `registerTrip` via FamilyContext
- `BookingImport` shared component (AI layer, dynamic dates); `ImportPage`
  for importing into the current trip anytime; JoinPage attaches familyId

### Track E — `agent/degreece`: content generalization
Owns: `src/i18n/*`, `src/pages/QuizPage.tsx`, `src/pages/PassportPage.tsx`,
`src/pages/HomePage.tsx`, `src/pages/RestaurantsPage.tsx`,
`src/pages/AdminPage.tsx`, `src/data/greeceQuizSeed.ts`.

- i18n: destination interpolation ({{destination}}), config-driven titles
- QuizPage reads `quizQuestions` from context; Greece bank → seed file;
  AdminPage quiz manager (seed Greece bank, AI-generate for destination,
  delete); dynamic day counts everywhere (passport, home "of N")
- RestaurantsPage map query uses destination

## Sprint 3 — Integration (scrum master)

- Merge C/D/E; wire `/trips`, `/trips/new`, `/import` routes in `App.tsx`
- CSS reconciliation (agents reuse existing classes; additions live in
  clearly-marked blocks at the end of `index.css`)
- `npm run build` + `npm run lint` green; manual route smoke pass
- Push to `claude/multi-trip-app-plan-aykv9c`

## Shared contracts

**FamilyContext** (Track A provides; C/D consume):
`{ family, familyId, familyLoading, trips: TripSummary[], refreshTrips(),
isFamilyAdmin, setActiveTrip(code), registerTrip(config, makeActive),
archiveTrip(code) }` via `useFamilyContext()`.

**TripContext additions** (Track A provides; C/D/E consume):
`{ isViewingActiveTrip, browseTrip(code), returnToActiveTrip(), totalDays,
quizQuestions }` plus existing fields.

**AI layer** (Track B provides; D/E consume): from `src/ai`:
`getAiSettings() / saveAiSettings()`, `generateText(prompt, settings?)`,
`extractFromImages(prompt, images, settings?)`,
`buildBookingPrompt(startDate, endDate)`.

**tripService additions** (Track A provides; E consumes):
`subscribeQuizQuestions`, `saveQuizQuestion`, `deleteQuizQuestion`.
