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
| P5-05 | End-to-end smoke test across all phases; fix regressions | ✅ Done |

---

## Phase 6 — AI Content Engine

| Task | Description | Status |
|------|-------------|--------|
| P6-01 | AI service layer (`aiService.ts` + `types/ai.ts`) | ✅ Done |
| P6-02 | i18n keys + CSS classes for Phase 6 UI | ✅ Done |
| P6-03 | Admin AI Config section (AdminPage update) | ✅ Done |
| P6-04 | AIImportModal component (generic) | ✅ Done |
| P6-05 | AISuggestPanel component (generic) | ✅ Done |
| P6-06 | Passport stamp Firestore service + updated PassportPage | ✅ Done |
| P6-07 | RestaurantsPage — AI Import + AI Suggest | ✅ Done |
| P6-08 | HighlightsPage — AI Import + AI Suggest | ✅ Done |
| P6-09 | Hotels + Flights pages — AI Import | ✅ Done |
| P6-10 | PassportPage — Generate Stamps wired up | ✅ Done |
| P6-11 | End-to-end smoke test + docs finalize | ✅ Done |

### Dependency Graph

```
Wave 1 (no dependencies — run in parallel):
  P6-01  AI service layer (aiService.ts + types/ai.ts)
  P6-02  i18n keys + CSS classes for Phase 6 UI

Wave 2 (depends on P6-01 types being available):
  P6-03  Admin AI Config section (AdminPage update)
  P6-04  AIImportModal component (generic)
  P6-05  AISuggestPanel component (generic)
  P6-06  Passport stamp Firestore service + updated PassportPage

Wave 3 (depends on P6-04 and P6-05):
  P6-07  RestaurantsPage — AI Import + AI Suggest wired up
  P6-08  HighlightsPage — AI Import + AI Suggest wired up
  P6-09  Hotels + Flights pages — AI Import wired up
  P6-10  PassportPage — Generate Stamps wired up (depends on P6-05 + P6-06)

Wave 4 (integration + QA):
  P6-11  End-to-end smoke test + docs finalize
```

---

### Wave 1 — Foundation (fully parallel)

#### P6-01 — AI Service Layer
**File**: `src/firebase/aiService.ts` (new) + `src/types/ai.ts` (new)

**Deliverables**:
- `src/types/ai.ts` — full type definitions: `AIProvider`, `AIConfig`, `ImportTarget`, `AIImportResult`, `AISuggestion`, `PassportStamp`
- `src/firebase/aiService.ts` with:
  - `getAIConfig(): AIConfig` — reads `localStorage['aiConfig']`, returns defaults if not set
  - `setAIConfig(c: AIConfig): void` — writes to localStorage
  - `callAI(prompt: string, images?: File[]): Promise<string>` — dispatches to correct adapter
  - `callGemini(config, prompt, images?) → string` — Gemini REST adapter
  - `callGroq(config, prompt, images?) → string` — Groq OpenAI-compat adapter
  - `callClaude(config, prompt, images?) → string` — Claude adapter (refactored from TravelLogPage)
  - `parseImport(jsonStr: string, target: ImportTarget): AIImportResult[]` — validate + map AI JSON to typed records; handle parse errors gracefully
  - `buildImportPrompt(target: ImportTarget, tripContext): string` — constructs extraction prompt with inline schema
  - `buildSuggestPrompt(type, tripContext): string` — constructs suggestion prompt with hotel/driving context
  - `extractSuggestions(jsonStr: string, type): AISuggestion[]` — validate + map suggestion output

**Notes**:
- Move Claude API call logic out of `TravelLogPage.tsx` into this service (TravelLogPage should call `callAI`)
- All adapters must convert `File[]` to base64 internally
- Gemini: use `generationConfig.responseMimeType: 'application/json'` for structured output
- Groq vision: use `image_url` with `data:image/{type};base64,{b64}` format
- Default config: `{ provider: 'gemini', model: 'gemini-2.5-flash-lite', apiKey: '' }`

---

#### P6-02 — i18n Keys + CSS
**Files**: `src/i18n/en.ts`, `src/i18n/he.ts`, `src/index.css`

**New i18n keys to add**:

```typescript
// en.ts additions
ai: {
  configTitle: 'AI Configuration',
  provider: 'Provider',
  model: 'Model',
  apiKey: 'API Key',
  testBtn: 'Test',
  testOk: 'Connection OK',
  testFail: 'Connection failed',
  saveConfig: 'Save Config',
  getKeyHint: 'Get a free key at',
  importBtn: 'AI Import',
  suggestBtn: 'AI Suggest',
  generateStamps: 'Generate Stamps',
  analyzing: 'Analyzing...',
  findingSuggestions: 'Finding suggestions...',
  noResults: 'No data found — try a clearer screenshot',
  reviewTitle: 'Review extracted data',
  suggestTitle: 'AI Suggestions',
  accept: 'Accept',
  skip: 'Skip',
  saveSelected: 'Save Selected',
  retryBtn: 'Retry',
  noKeyConfigured: 'Configure AI provider in Admin settings first',
  rateLimitError: 'Rate limit — wait a minute and retry',
  parseError: 'Could not parse AI response',
  nearHotel: 'Near {{hotel}}',
  onRoute: 'Along {{from}} → {{to}} route',
  rationale: 'Why: {{reason}}',
},
passport: {
  stamps: 'Stamps',
  earnStamp: 'Collect',
  stampEarned: 'Earned!',
  noStamps: 'No stamps yet — admin can generate them with AI',
  generateStamps: 'Generate Stamps',
},
```

**New CSS classes** (add to `src/index.css`):
```
.ai-config-section, .ai-config-row, .ai-config-label
.ai-import-btn, .ai-suggest-btn
.ai-modal (extends .modal), .ai-upload-zone, .ai-paste-area
.ai-review-list, .ai-result-card, .ai-result-card.accepted, .ai-result-card.rejected
.ai-result-field, .ai-result-field label, .ai-result-field input
.ai-suggest-panel, .ai-suggest-group, .ai-suggest-group-header
.ai-suggestion-card, .ai-suggestion-rationale
.passport-stamps-grid, .passport-stamp-card, .passport-stamp-card.earned
.passport-stamp-icon, .passport-stamp-title, .passport-stamp-earn-btn
```

---

### Wave 2 — Core Components (parallel after P6-01 types exist)

#### P6-03 — Admin AI Config Section
**File**: `src/pages/AdminPage.tsx` (modify)

Add a new collapsible section **at the top** of AdminPage (before Family Members):

```
<section className="admin-section">
  <h2>AI Configuration</h2>
  <div className="ai-config-row">
    <label>Provider</label>
    <select> Gemini | Groq | Claude </select>
  </div>
  <div className="ai-config-row">
    <label>Model</label>
    <input type="text" />
    <!-- Preset buttons shown based on provider:
         Gemini: [gemini-2.5-flash-lite] [gemini-2.5-flash] [gemini-2.5-pro]
         Groq:   [llama-3.2-11b-vision-preview] [llama-3.3-70b-versatile]
         Claude: [claude-haiku-4-5-20251001] [claude-sonnet-4-6]
    -->
  </div>
  <div className="ai-config-row">
    <label>API Key</label>
    <input type="password" />
    <a href="..." target="_blank">Get free key ↗</a>
  </div>
  <div style={{ display: 'flex', gap: 8 }}>
    <button onClick={handleTest}>Test</button>
    <button onClick={handleSave} className="primary">Save Config</button>
  </div>
  {testResult && <p>{testResult}</p>}
</section>
```

**Logic**:
- On mount: `getAIConfig()` populates form
- `handleSave`: `setAIConfig(form)` + show success toast
- `handleTest`: call `callAI('Reply with: ok', [])` → show OK or error message
- Provider change → auto-fill model with first preset for that provider
- Show provider-specific "get key" link:
  - Gemini: `https://aistudio.google.com/apikey`
  - Groq: `https://console.groq.com/keys`
  - Claude: `https://console.anthropic.com/`

**Notes**: Import `getAIConfig`, `setAIConfig`, `callAI` from `aiService.ts`. Do not import types from old locations.

---

#### P6-04 — AIImportModal Component
**File**: `src/components/AIImportModal.tsx` (new)

```typescript
interface AIImportModalProps {
  target: ImportTarget;            // 'restaurant' | 'highlight' | 'hotel' | 'flight'
  tripContext: { days: TripDay[], hotels: Hotel[], driving: DrivingSegment[] };
  onAccept: (items: any[]) => void;
  onClose: () => void;
}
```

**State machine** (local state enum): `'idle' | 'processing' | 'review' | 'error'`

**UI — idle state**:
- Drag-and-drop upload zone (accepts image/* and .pdf)
- Textarea: "Or paste text / URL description"
- "Analyze" button (disabled if neither images nor text provided)
- Note showing current AI provider + model from `getAIConfig()`

**UI — processing state**:
- Spinner + "Analyzing with Gemini 2.0 Flash..."
- Cannot be dismissed (or shows cancel option)

**UI — review state**:
- Heading: "Found N items"
- List of `AIResultCard` sub-components (one per extracted record):
  - All fields as controlled inputs (editable inline)
  - Accept/Reject toggle (default: accepted)
  - Rejected cards visually dimmed
- "Save X selected" button + "Discard all" button

**UI — error state**:
- Error message (user-friendly based on error type)
- Optional collapsible raw response for debugging
- Retry + Close buttons

**Implementation notes**:
- Calls `parseImport(await callAI(prompt, images), target)` then sets state to `'review'`
- "Save selected" calls `onAccept(results.filter(r => r.accepted).map(r => r.data))`
- Does NOT write to Firestore directly — parent page handles that
- Use existing `.modal-overlay` + `.modal` CSS classes as base, extend with `.ai-modal`
- File-to-base64 utility: reuse pattern from `SetupPage.tsx`

---

#### P6-05 — AISuggestPanel Component
**File**: `src/components/AISuggestPanel.tsx` (new)

```typescript
interface AISuggestPanelProps {
  type: 'restaurant' | 'highlight' | 'passport-stamp';
  tripContext: { hotels: Hotel[], driving: DrivingSegment[], days: TripDay[], existing: any[] };
  onAccept: (items: any[]) => void;
}
```

**UI** (collapsible panel, starts closed):
- Header row: Sparkles icon + "AI Suggest" button → triggers loading
- Loading: progress spinner + "Finding suggestions..."
- Results: accordion grouped by location (hotel name or driving route)
  - Each `SuggestionCard`: icon, name, rationale subtitle, Accept / Skip buttons
  - "Accept All" shortcut
- Error: inline error message + Retry

**Implementation notes**:
- Calls `suggestContent(context, type)` → `AISuggestion[]`
- Accepted items returned via `onAccept()` — no direct Firestore writes
- Panel stays open after accepting so admin can cherry-pick multiple
- Re-triggering "AI Suggest" clears previous results

---

#### P6-06 — Passport Stamp Firestore Service + PassportPage Redesign
**Files**: `src/firebase/tripService.ts` (modify), `src/pages/PassportPage.tsx` (rewrite), `src/context/TripContext.tsx` (modify)

**Firestore service additions** (tripService.ts):
```typescript
export function subscribePassportStamps(tripCode: string, cb: (stamps: PassportStamp[]) => void): Unsubscribe
export async function savePassportStamp(tripCode: string, stamp: PassportStamp): Promise<void>
export async function deletePassportStamp(tripCode: string, stampId: string): Promise<void>
export async function earnPassportStamp(tripCode: string, memberId: string, stampId: string): Promise<void>
// stores to trips/{tripCode}/earnedStamps/{memberId}_{stampId}
```

**TripContext additions**:
- `passportStamps: PassportStamp[]` state + subscription
- `earnedStamps: EarnedStamp[]` (memberId + stampId pairs for current member)

**PassportPage rewrite**:
- Show stamp grid (passport-book aesthetic): each stamp card shows icon, title, location
- Earned stamps: colorful + "✓ Earned!" overlay
- Unearned stamps: greyed out + "Collect" button (if no `highlightId`) or "Visit {highlight}" hint
- Auto-earn check on load: for each stamp with `highlightId`, check if linked highlight is completed by current member → auto-earn if so
- Admin controls (isAdmin): Delete stamp button per card + "Generate Stamps" button (triggers AISuggestPanel)

---

### Wave 3 — Page Integration (parallel after P6-04 + P6-05)

#### P6-07 — RestaurantsPage AI Integration
**File**: `src/pages/RestaurantsPage.tsx` (modify)

**Changes**:
1. Add `AIImportModal` — shown when admin clicks "AI Import" in the page header action bar (next to existing "Add" button)
2. Add `AISuggestPanel` — shown below the filter tabs (admin only)
3. `onAccept` from modal: for each item, call `saveRestaurant(tripCode, { ...item, id: \`rest-${Date.now()}\`, ratings: {}, visited: false })`
4. `onAccept` from suggest panel: same as above

**UI change**: Page header action row (admin):
```
[UtensilsCrossed icon] Restaurants   [+ Add] [AI Import] [AI Suggest]
```

---

#### P6-08 — HighlightsPage AI Integration
**File**: `src/pages/HighlightsPage.tsx` (modify)

Same pattern as P6-07:
1. `AIImportModal` for import
2. `AISuggestPanel` for suggestions
3. `onAccept` from modal: call `saveHighlight(tripCode, { ...item, id: \`hl-${Date.now()}\`, completed: false, completedBy: [] })`
4. `onAccept` from suggest panel: same

**UI change**: Page header:
```
[Star icon] Highlights   [+ Add] [AI Import] [AI Suggest]
```

---

#### P6-09 — Hotels + Flights AI Import
**Files**: `src/pages/HotelsPage.tsx`, `src/pages/FlightsPage.tsx` (modify each)

Add "AI Import" button (admin only) in each page header. No suggest panel needed (hotels/flights aren't suggested — they're booked).

Hotels `onAccept`: `saveHotel(tripCode, { ...item, id: \`hotel-${Date.now()}\` })`
Flights `onAccept`: `saveFlight(tripCode, { ...item, id: \`flight-${Date.now()}\` })`

---

#### P6-10 — PassportPage AI Stamp Generation
**File**: `src/pages/PassportPage.tsx` (already rewritten in P6-06)

Wire in `AISuggestPanel` with `type='passport-stamp'`:
- `onAccept`: for each stamp, call `savePassportStamp(tripCode, stamp)`
- Panel shown at top of page (admin only)

**Note**: This task is a small addition within the P6-06 rewrite. Can be done by same agent as P6-06.

---

### Wave 4 — Integration & QA

#### P6-11 — End-to-End Smoke Test + Finalize Docs
- Test full flow with Gemini 2.0 Flash: import restaurant from screenshot → review → save → appears in list
- Test with Groq: same flow
- Test suggest flow: hotels in context → restaurant suggestions appear
- Test passport stamps: generate → accept → earn via highlight complete
- Verify no TypeScript errors (`npm run build`)
- Update TASKS.md status to Done
- Update MEMORY.md with Phase 6 patterns

---

### Parallelism Summary

```
Agent 1: P6-01 (aiService + types)          ← start immediately
Agent 2: P6-02 (i18n + CSS)                 ← start immediately

Agent 3: P6-03 (Admin AI config)            ← after P6-01 types exist
Agent 4: P6-04 (AIImportModal)              ← after P6-01 types exist
Agent 5: P6-05 + P6-06 (AISuggestPanel + PassportPage) ← after P6-01

Agent 6: P6-07 (Restaurants)               ← after P6-04 + P6-05
Agent 7: P6-08 (Highlights)                ← after P6-04 + P6-05
Agent 8: P6-09 (Hotels + Flights)          ← after P6-04
Agent 9: P6-10 (Passport wiring)           ← after P6-05 + P6-06 (same as Agent 5)

Agent 10: P6-11 (QA + docs)               ← after all above
```

Total wall-clock time with 9 parallel agents: ~4 waves instead of sequential execution.
