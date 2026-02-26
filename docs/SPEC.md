# Family Trip App — Technical Specification

## Overview
A React 19 + Vite + Firebase PWA for the family Greece 2026 trip. Supports 6 family members (4 with Google accounts, 2 virtual "tablet kids"), real-time data sync via Firestore, offline capability, bilingual (Hebrew/English), and dark mode.

## Family Structure
| Member | Emoji | Device | Auth |
|--------|-------|--------|------|
| Dad | 👨 | Phone | Google (admin) |
| Mom | 👩 | Phone | Google |
| Big Kid 1 | 🧒 | Phone | Google (optional) |
| Big Kid 2 | 🧒 | Phone | Google (optional) |
| Small Kid 1 | 👶 | Tablet | Virtual (no login) |
| Small Kid 2 | 👶 | Tablet | Virtual (no login) |

Admin email: `avielbl@gmail.com`

## Data Model

### Firestore Collections

```
trips/{tripCode}                    # TripConfig document
trips/{tripCode}/days/{dayIndex}    # TripDay
trips/{tripCode}/flights/{id}       # Flight
trips/{tripCode}/hotels/{id}        # Hotel
trips/{tripCode}/driving/{id}       # DrivingSegment
trips/{tripCode}/rentalCars/{id}    # RentalCar
trips/{tripCode}/highlights/{id}    # Highlight
trips/{tripCode}/restaurants/{id}   # Restaurant
trips/{tripCode}/packing/{id}       # PackingItem
trips/{tripCode}/photos/{id}        # PhotoEntry
trips/{tripCode}/quizAnswers/{id}   # QuizAnswer
trips/{tripCode}/travelLog/{id}     # TravelLogEntry
users/{uid}                         # UserProfile
```

### Key Types

#### TripConfig
```typescript
{
  tripCode: string;
  tripName: string;
  startDate: string;       // ISO date
  endDate: string;
  familyMembers: FamilyMember[];
  adminUid?: string;       // set when admin first signs in
}
```

#### FamilyMember
```typescript
{
  id: string;
  name: string;
  nameHe: string;
  emoji: string;
  deviceType: 'phone' | 'tablet';
  email?: string;          // for Google-auth matching
  isVirtual?: boolean;     // true for tablet kids
}
```

#### UserProfile
```typescript
{
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  tripCode?: string;
  memberId?: string;       // matched FamilyMember.id
  createdAt: string;
}
```

#### TravelLogEntry
```typescript
{
  id: string;
  dayIndex: number;
  title: string;
  titleHe?: string;
  location: string;
  blocks: ContentBlock[];
  generatedAt?: string;
  updatedAt: string;
}
```

#### ContentBlock
```typescript
{
  id: string;
  type: 'text' | 'photo';
  content?: string;        // text content
  contentHe?: string;
  imageUrl?: string;       // for photo blocks
  caption?: string;
  captionHe?: string;
  order: number;
}
```

## Architecture

```
AuthProvider
  └─ TripProvider
       └─ BrowserRouter
            └─ AppRoutes
```

### Auth Flow
1. App loads → check `firebaseUser` from Firebase Auth
2. If signed in → `upsertUserProfile()` → `matchMemberByEmail()` → set `currentMember`
3. If on tablet (no Google) → show `VirtualMemberPicker` modal
4. Admin identified by `firebaseUser.email === 'avielbl@gmail.com'`

### isAdmin
`isAdmin = firebaseUser?.email === ADMIN_EMAIL`

## Routes
- `/` — Home (countdown, today summary)
- `/flights` — Flights
- `/hotels` — Hotels
- `/driving` — Driving + Rental Cars
- `/highlights` — Highlights/attractions
- `/restaurants` — Restaurants
- `/passport` — Trip passport stamps
- `/photos` — Photo journal
- `/quiz` — Daily quiz
- `/packing` — Packing list
- `/settings` — Language, member selection, Google info
- `/setup` — Initial trip setup
- `/join/:tripCode` — Public invite landing page
- `/admin` — Admin management (admin-only)
- `/travel-log` — Travel log (all members)

## Security Rules
- **Reads**: `request.auth != null` (any authenticated user)
- **Itinerary writes** (days, flights, hotels, driving, rentalCars, highlights, restaurants, packing): admin only
- **Member writes** (completions, ratings, photos, quizAnswers, travelLog): any authenticated member

## i18n
Languages: English (`en`) and Hebrew (`he`). Uses `react-i18next`. RTL layout via `dir="rtl"` on app container. Font: Heebo (Hebrew), Inter (English).

---

## Phase 6 — AI Content Engine

### Overview
The AI Content Engine adds two capabilities to the admin workflow:
1. **Content Ingestion** — parse screenshots or pasted text to extract structured trip data (restaurants, highlights, hotels, flights) and surface them for admin review and one-click save.
2. **Context-Aware Suggestions** — given the trip's itinerary (hotels + driving segments), proactively suggest relevant restaurants, attractions, and passport stamp achievements, displayed as reviewable cards.

Both capabilities share a common **multi-provider AI service layer** that abstracts over Gemini, Groq/Llama, Claude, and (optionally) OpenAI. The admin configures which provider + model + API key to use from the Admin page; this config is stored in `localStorage` only (never persisted to Firestore, as API keys must not leave the device).

### Supported AI Providers

| Provider | Recommended Model | Model ID | Vision | Free Tier (Feb 2026) |
|----------|------------------|----------|--------|-----------|
| **Google Gemini** ⭐ | Gemini 2.5 Flash-Lite | `gemini-2.5-flash-lite` | ✅ | **15 RPM, 1 000 RPD**, 250K TPM — best free throughput |
| Google Gemini | Gemini 2.5 Flash | `gemini-2.5-flash` | ✅ | 10 RPM, 250 RPD, 250K TPM |
| Google Gemini | Gemini 2.5 Pro | `gemini-2.5-pro` | ✅ | 5 RPM, 100 RPD — most capable |
| **Groq** | Llama 3.2 Vision 11B | `llama-3.2-11b-vision-preview` | ✅ | Free tier (check console for current limits) |
| Groq | Llama 3.3 70B | `llama-3.3-70b-versatile` | ❌ | Free tier, text only, very fast |
| Claude (existing) | Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | ✅ | Paid (cheapest Claude) |
| Claude (existing) | Claude Sonnet 4.6 | `claude-sonnet-4-6` | ✅ | Paid |

> ⚠️ **Note**: Gemini 2.0 Flash is **retired as of March 3, 2026** — do not use `gemini-2.5-flash-lite`.

**Default recommendation: Gemini 2.5 Flash-Lite** — highest free-tier throughput (15 RPM, 1000 req/day), full vision support, native JSON output mode, 1M token context window. Get a free API key at [aistudio.google.com](https://aistudio.google.com/apikey) — no credit card required.

### AI Config Data Model (localStorage only)

```typescript
// Stored as JSON in localStorage['aiConfig']
interface AIConfig {
  provider: 'gemini' | 'groq' | 'claude';
  model: string;            // e.g. 'gemini-2.5-flash-lite'
  apiKey: string;           // provider API key
}
```

Default (pre-filled): `{ provider: 'gemini', model: 'gemini-2.5-flash-lite', apiKey: '' }`

### Feature 1 — Content Ingestion

**Trigger**: Admin taps "AI Import" button on RestaurantsPage, HighlightsPage, HotelsPage, or FlightsPage.

**Input modes**:
- Upload one or more image files (screenshots of booking sites, Google Maps, TripAdvisor, etc.)
- Paste free-form text (copied webpage, URL description, notes)

**Processing**:
1. Send image(s) + text to AI provider with a structured extraction prompt specifying the target schema (Restaurant | Highlight | Hotel | Flight)
2. AI returns a JSON array of extracted records
3. App displays extraction results as reviewable cards: each record shown with all parsed fields editable
4. Admin can accept (saves to Firestore), edit then accept, or reject individual records

**Target extraction schemas**:

| Page | Extracts as | Key fields pulled |
|------|------------|-------------------|
| RestaurantsPage | `Restaurant[]` | name, cuisine, city, address, phone, priceRange, notes |
| HighlightsPage | `Highlight[]` | name, category, description, address, openingHours, ticketInfo |
| HotelsPage | `Hotel[]` | name, address, city, checkIn, checkOut, confirmationCode |
| FlightsPage | `Flight[]` | airline, flightNumber, departure/arrival airports + times, confirmationCode |

### Feature 2 — Context-Aware Suggestions

**Trigger**: Admin taps "AI Suggest" button on RestaurantsPage or HighlightsPage, or "Generate Stamps" on PassportPage.

**Context sent to AI**:
- Hotel list (name, city, check-in/out dates)
- Driving segments (from → to, dayIndex)
- Trip days (titles, locations)
- Existing restaurants/highlights (to avoid duplicates)

**Output**:

| Feature | Suggestions |
|---------|-------------|
| Restaurant suggestions | 3–5 restaurants near each hotel, categorised by meal type and price range |
| Highlight suggestions | 3–5 attractions per location: mix of must-sees, kid-friendly, off-the-beaten-path |
| Passport stamp suggestions | One stamp achievement per day/location (e.g. "Acropolis Conqueror — visited the Parthenon", "Santorini Sunset Watcher") |

All suggestion outputs follow the same review-and-accept flow as ingestion.

### New Firestore Collection
None — no new collections. All accepted records land in existing subcollections (restaurants, highlights, etc.).

### New Types

```typescript
// src/types/ai.ts  (new file)

export type AIProvider = 'gemini' | 'groq' | 'claude';

export interface AIConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
}

export type ImportTarget = 'restaurant' | 'highlight' | 'hotel' | 'flight';

export interface AIImportSession {
  target: ImportTarget;
  status: 'idle' | 'processing' | 'review' | 'done' | 'error';
  error?: string;
  results: AIImportResult[];
}

export interface AIImportResult {
  id: string;          // client-side temporary ID
  data: Partial<Restaurant | Highlight | Hotel | Flight>;
  accepted: boolean;
  edited: boolean;
}

export interface AISuggestion {
  id: string;
  type: 'restaurant' | 'highlight' | 'passport-stamp';
  data: Partial<Restaurant | Highlight | PassportStamp>;
  rationale: string;   // e.g. "Near Hilton Athens on Day 2"
  accepted: boolean;
}

export interface PassportStamp {
  id: string;
  dayIndex: number;
  title: string;
  titleHe?: string;
  description: string;
  icon: string;        // emoji
  location: string;
  earnCondition: string;  // e.g. "Visit the Acropolis (mark highlight as done)"
  highlightId?: string;  // linked highlight if auto-earned
}
```

### New Firestore Collection: passport stamps

```
trips/{tripCode}/passportStamps/{id}   # PassportStamp
```

Passport stamps are admin-created (manually or via AI suggest). A stamp is "earned" per member when the linked highlight is marked complete, or manually via the PassportPage.

### Acceptance Criteria

- [ ] Admin can configure AI provider, model, and API key in AdminPage
- [ ] "AI Import" button appears (admin-only) on Restaurants, Highlights, Hotels, Flights pages
- [ ] Import flow: upload image or paste text → AI extracts → review cards → save selected
- [ ] "AI Suggest" button on Restaurants and Highlights — suggestions tied to hotel/route context
- [ ] "Generate Stamps" on PassportPage — AI proposes stamp achievements per day
- [ ] All accepted items persist normally through existing Firestore write paths
- [ ] No API keys ever written to Firestore
- [ ] Works with Gemini 2.0 Flash (default), Groq Llama Vision, and Claude providers
- [ ] Error states shown for missing API key, rate limit, or malformed AI response
- [ ] Bilingual: all new UI strings in both `en.ts` and `he.ts`
