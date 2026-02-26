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

## No New Dependencies (Phases 1–5)
`firebase` already includes `GoogleAuthProvider` + `signInWithPopup`. Claude API uses native `fetch`.

---

## Phase 6 — AI Content Engine: Architecture & Design

### Design Principles
1. **Provider-agnostic** — one internal interface, multiple backends. Adding a new provider = one new adapter function.
2. **Offline-safe** — AI calls only happen on admin action; no background polling. Regular trip data is unaffected if AI is unavailable.
3. **Keys stay local** — API keys never leave the device. Config in `localStorage['aiConfig']`.
4. **Review-before-save** — AI output is always surfaced for admin review. No silent writes.
5. **Schema-first** — prompts include the exact TypeScript interface as context so AI returns well-typed JSON.

---

### Service Layer: `src/firebase/aiService.ts`

Central module. All pages call this; it reads `AIConfig` from localStorage and routes to the right provider adapter.

```
aiService.ts
  ├── getAIConfig() → AIConfig         (read localStorage)
  ├── setAIConfig(c: AIConfig)         (write localStorage)
  ├── callAI(prompt, images?) → string (dispatch to adapter)
  ├── parseScreenshots(files, target)  → AIImportResult[]
  ├── parseText(text, target)          → AIImportResult[]
  └── suggestContent(context, type)   → AISuggestion[]

Provider Adapters (internal):
  ├── callGemini(config, prompt, images?) → string
  ├── callGroq(config, prompt, images?)   → string
  └── callClaude(config, prompt, images?) → string   ← existing logic, moved here
```

**Gemini adapter** — `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`
- Header: none (key in query param)
- Body: `{ contents: [{ parts: [{ text }, { inlineData: { mimeType, data } }] }], generationConfig: { responseMimeType: 'application/json' } }`
- Enables native JSON mode for clean extraction

**Groq adapter** — OpenAI-compatible: `POST https://api.groq.com/openai/v1/chat/completions`
- Header: `Authorization: Bearer {apiKey}`
- Supports `llama-3.2-11b-vision-preview` for images (base64 in `image_url` data URI)
- Falls back to text-only for `llama-3.3-70b-versatile`

**Claude adapter** — existing logic extracted from TravelLogPage/SetupPage
- `POST https://api.anthropic.com/v1/messages`
- Headers: `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`

---

### New Component: `src/components/AIImportModal.tsx`

Generic modal used by Restaurants, Highlights, Hotels, Flights pages.

```
Props:
  target: ImportTarget
  onAccept(items): void
  onClose(): void

State machine:
  idle → (user uploads/pastes) → processing → review → done
                                     ↓ error ←───────────

UI:
  [idle]     Upload zone (drag+drop images) + textarea for pasted text + "Analyze" button
  [process]  Spinner + "Analyzing with {provider} {model}..."
  [review]   List of extracted cards, each with:
               - All fields displayed as editable inputs
               - ✓ Accept / ✗ Reject toggle
             "Save Selected" button → calls onAccept(accepted items)
  [error]    Error message + retry
```

---

### New Component: `src/components/AISuggestPanel.tsx`

Collapsible panel that appears on RestaurantsPage, HighlightsPage, and PassportPage for admin.

```
Props:
  type: 'restaurant' | 'highlight' | 'passport-stamp'
  context: { hotels, driving, days, existing }
  onAccept(items): void

State: idle | loading | results | error

UI:
  [idle]    "AI Suggest" button with Sparkles icon
  [loading] "Finding suggestions..." spinner
  [results] Accordion grouped by location:
              "Near Hilton Athens (Day 2–3)"
                 └─ SuggestionCard × N  (rationale shown as subtitle)
              Each card: Accept / Skip buttons
  [error]   Error + retry
```

---

### Passport Stamps Redesign

Current PassportPage renders day-based stamps derived from highlights. Phase 6 introduces **admin-defined stamps** stored in Firestore (`passportStamps` subcollection).

```
PassportStamp {
  id, dayIndex, title, titleHe, description,
  icon (emoji), location, earnCondition,
  highlightId?   ← if set, auto-earned when highlight.completed
}
```

**Earning logic (client-side)**:
- If `highlightId` set → stamp earned when that highlight appears in `highlights` with `completed: true` for this member
- Otherwise → manual "Collect stamp" button in PassportPage

**Admin flow**:
1. Admin taps "Generate Stamps" → `AISuggestPanel` with type=`passport-stamp`
2. AI generates one stamp per day/location based on itinerary context
3. Admin reviews → accepts → stamps saved to `trips/{code}/passportStamps/`

---

### Admin Page — AI Config Section

Added as the first section of AdminPage (above Family Members):

```
┌─ AI Configuration ──────────────────────────┐
│ Provider:  [Gemini ▾]  (Groq | Claude)       │
│ Model:     [gemini-2.5-flash-lite     ]       │
│            [Presets: Flash-Lite | Flash | Pro]│
│ API Key:   [AI...••••••••••••••••]  [Test]    │
│            ℹ Get free key at aistudio.google.com │
│                              [Save Config]    │
└──────────────────────────────────────────────┘
```

Config saved to `localStorage['aiConfig']`. Test button sends a tiny prompt and shows success/failure inline.

---

### Data Flow Diagram

```
Admin Action
    │
    ▼
[AIImportModal or AISuggestPanel]
    │ calls
    ▼
aiService.callAI() / suggestContent()
    │ routes to adapter
    ▼
[Gemini | Groq | Claude] API call
    │ returns JSON string
    ▼
aiService.parseResponse(json, target)
    │ validates + maps to typed records
    ▼
Review UI → Admin accepts subset
    │ calls existing tripService fns
    ▼
Firestore write (existing paths, no change)
    │ real-time listener
    ▼
All family members see updated content
```

---

### Prompt Engineering Strategy

Each prompt follows this structure:

```
ROLE: You are a travel data extractor for a family trip app.
CONTEXT: <trip dates, locations>
TASK: Extract <target> data from the provided <image/text>.
SCHEMA: <TypeScript interface pasted inline>
OUTPUT: Return ONLY a JSON array matching the schema. No markdown, no explanation.
CONSTRAINTS: <field-specific rules, e.g. priceRange must be '$' | '$$' | '$$$'>
```

For suggestions, the context section includes the full hotel/driving schedule so AI can ground suggestions geographically and temporally.

---

### Error Handling

| Error | Handling |
|-------|----------|
| No API key configured | Show "Configure AI in Admin settings" message, link to /admin |
| API rate limit (429) | Show "Rate limit hit — wait 1 minute and retry" |
| Non-JSON response | Show raw response in collapsible debug pane + retry |
| Network error | "Check your connection" + retry |
| Empty extraction | "No data found — try a clearer screenshot or add more text" |

---

### No New npm Dependencies
All HTTP calls use native `fetch`. File reading uses `FileReader` (already in use). No new packages required.
