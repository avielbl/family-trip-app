# Family Trip App — Implementation Plan

## Architecture Decisions

### AuthContext wraps TripContext
```
AuthProvider → TripProvider → AppRoutes
```
Rationale: TripContext needs `currentMember` which depends on auth state. AuthContext provides `firebaseUser`, `userProfile`, `isAdmin`, and (for virtual members) `selectVirtualMember`.

### Admin Detection
`isAdmin = firebaseUser?.email === 'avielbl@gmail.com'`
Simple email check — no Firestore lookup needed for basic role check.

### Virtual Members
Small kids (tablet users) have no Google account. The shared tablet shows a `VirtualMemberPicker` modal when no `currentMember` is set in localStorage. Selection is persisted per-device.

### Migration: Anonymous → Google Auth
1. Keep permissive Firestore rules during transition (`request.auth != null`)
2. Admin signs in first → "Claim Admin" button in AdminPage sets `trips/{code}.adminUid`
3. Admin sets emails on family members via AdminPage
4. Other members click invite link → sign in with Google → auto-matched by email
5. Once all real members joined, tighten rules to full RBAC
6. No Firestore data migration needed

## User Stories

### Admin (Dad)
- Creates the trip, uploads confirmations, sets up members
- Can add/edit/delete all itinerary data (flights, hotels, highlights, etc.)
- Can see "Copy Invite Link" in Settings
- Has access to `/admin` page for managing members
- Can generate AI travel log entries

### Authenticated Member (Mom, Big Kids)
- Clicks invite link → signs in with Google → auto-matched to family member
- Can mark highlights as visited, rate restaurants, upload photos, answer quiz
- Can edit travel log text blocks, add photo blocks
- Can see trip info, packing list (check/uncheck)

### Virtual Member (Tablet Kids)
- Shared tablet shows member picker on first use
- Selected member stored in localStorage
- Same experience as authenticated member (no write restrictions for now)

## Phase Breakdown

### Phase 1 — Quick Wins
Zero auth changes, zero breakage risk.
- Fix default member count (5 → correct)
- Semantic CSS tokens (prerequisite for dark mode)
- Dark mode toggle (persisted in localStorage)
- Create `/docs/` folder

### Phase 2 — Google Authentication
- Enable Google provider in Firebase
- Update types (`email?`, `isVirtual`, `UserProfile`, `TravelLogEntry`, `ContentBlock`)
- Create `authService.ts` and `AuthContext.tsx`
- Wrap app with `AuthProvider`
- Create `JoinPage` and `VirtualMemberPicker`
- Update `SettingsPage` with Google info + sign-out

### Phase 3 — Admin System
- Deploy updated Firestore rules
- Admin UI conditionally rendered on all content pages
- `AdminPage` for member management + invite link
- Admin + Travel Log in navigation

### Phase 4 — Travel Log
- Service functions in Firestore
- `TravelLogPage` with day tabs, text + photo rendering
- AI generation via Claude API
- Inline editing by any member

### Phase 5 — Documentation & QA
- Finalize all docs
- Add i18n keys for new features
- End-to-end smoke test

## No New Dependencies
`firebase` already includes `GoogleAuthProvider` + `signInWithPopup`. Claude API uses native `fetch`.
