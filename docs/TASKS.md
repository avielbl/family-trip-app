# Family Trip App — Task Tracker

## Phase 1 — Quick Wins

| Task | Description | Status |
|------|-------------|--------|
| P1-01 | Remove 6th default member; update to 5 with correct emojis + device types | ✅ Done |
| P1-02 | Add semantic CSS token layer (`--bg-primary`, `--text-primary`, etc.) | ✅ Done |
| P1-03 | Dark mode toggle (moon/sun in top bar, `data-theme="dark"`, localStorage) | ✅ Done |
| P1-04 | Create `/docs/` with `SPEC.md`, `PLAN.md`, `TASKS.md` | ✅ Done |

## Phase 2 — Google Authentication

| Task | Description | Status |
|------|-------------|--------|
| P2-01 | Enable Google provider in Firebase Console + export `googleProvider` from `config.ts` | ✅ Done |
| P2-02 | Update `src/types/trip.ts` — add `email?`, `isVirtual`, `UserProfile`, `TravelLogEntry`, `ContentBlock` | ✅ Done |
| P2-03 | Create `src/firebase/authService.ts` — `signInWithGoogle`, `signOutUser`, `upsertUserProfile`, `joinTripByCode`, `matchMemberByEmail` | ✅ Done |
| P2-04 | Create `src/context/AuthContext.tsx` — `firebaseUser`, `userProfile`, `isAdmin`, `signInWithGoogle`, `selectVirtualMember` | ✅ Done |
| P2-05 | Wrap App with AuthProvider; update TripContext to use AuthContext; remove `ensureAuth()` calls; add travelLog subscription | ✅ Done |
| P2-06 | Create `src/pages/JoinPage.tsx` — `/join/:tripCode` public invite landing page | ✅ Done |
| P2-07 | Create `src/components/VirtualMemberPicker.tsx` — modal overlay on shared tablet | ✅ Done |
| P2-08 | Update SettingsPage — Google user info, sign-out, "Copy Invite Link" (admin only) | ✅ Done |

## Phase 3 — Admin System & RBAC

| Task | Description | Status |
|------|-------------|--------|
| P3-01 | Deploy updated Firestore + Storage rules | ✅ Done |
| P3-02 | Add `isAdmin: boolean` to TripContext from AuthContext | ✅ Done |
| P3-03 | Admin UI on HighlightsPage — add/edit/delete controls | ✅ Done |
| P3-04 | Admin UI on FlightsPage — add/edit/delete | ✅ Done |
| P3-05 | Admin UI on HotelsPage — add/edit/delete | ✅ Done |
| P3-06 | Admin UI on DrivingPage + RentalCars — add/edit/delete | ✅ Done |
| P3-07 | Admin UI on RestaurantsPage — add/edit/delete | ✅ Done |
| P3-08 | Admin UI on PackingPage — admin adds/deletes; all members check/uncheck | ✅ Done |
| P3-09 | Create `src/pages/AdminPage.tsx` — `/admin` route (admin guard) | ✅ Done |
| P3-10 | Add Admin + Travel Log nav items (admin-gated for admin link) | ✅ Done |

## Phase 4 — Travel Log Feature

| Task | Description | Status |
|------|-------------|--------|
| P4-01 | Add travelLog Firestore service functions | ✅ Done |
| P4-02 | Add `travelLog: TravelLogEntry[]` state + subscription to TripContext | ✅ Done |
| P4-03 | Create `src/pages/TravelLogPage.tsx` — read-only view with day tabs | ✅ Done |
| P4-04 | Add AI generation — Claude API call using stored API key | ✅ Done |
| P4-05 | Add inline editing — any member can edit text blocks, add/remove photo blocks | ✅ Done |

## Phase 5 — Documentation & QA

| Task | Description | Status |
|------|-------------|--------|
| P5-01 | Finalize `docs/SPEC.md` with complete data model | ✅ Done |
| P5-02 | Finalize `docs/PLAN.md` with architecture + user stories | ✅ Done |
| P5-03 | Finalize `docs/TASKS.md` with all tasks + statuses | ✅ Done |
| P5-04 | Add all i18n keys (en.ts + he.ts) for new features | ✅ Done |
| P5-05 | End-to-end smoke test across all phases; fix regressions | 🔄 In Progress |
