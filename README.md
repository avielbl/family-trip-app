# Family Trip App — Greece 2026

A bilingual (English/Hebrew) Progressive Web App for managing a family trip to Greece.
**Stack:** React 19 + TypeScript + Vite · Firebase Firestore + Anonymous Auth · PWA (installable)

---

## Repo Completeness Review

### What exists

| Area | Status | Notes |
|---|---|---|
| React app shell | ✅ Complete | `App.tsx`, routing, layout |
| Firestore service | ✅ Complete | CRUD + real-time subscriptions for all entities |
| Type definitions | ✅ Complete | `src/types/trip.ts` — all data shapes defined |
| i18n (EN/HE) | ✅ Complete | `src/i18n/` — both languages wired up |
| All feature pages | ✅ Complete | Flights, Hotels, Driving, Highlights, Restaurants, Passport, Photos, Quiz, Packing, Settings |
| Setup / onboarding flow | ✅ Complete | Create trip → enter family members → upload confirmations → Claude parses them |
| Claude AI parsing | ✅ Complete | `SetupPage` calls Anthropic API to extract booking data from screenshots |
| PWA config | ✅ Complete | `vite.config.ts`, service worker via `vite-plugin-pwa`, offline Firestore persistence |
| Firestore security rules | ✅ Complete | `firestore.rules` — auth-gated read/write |
| Firebase Hosting config | ✅ Complete | `firebase.json` — SPA rewrite, `dist/` target |
| `.env.example` | ✅ Complete | All required keys documented |

### What is missing / needs attention

| Item | Severity | Fix |
|---|---|---|
| **`.env` file not created**| 🔴 Blocker | Copy `.env.example` → `.env` and fill in real Firebase config (see GCP section below) |
| **`.firebaserc` missing** | 🔴 Blocker | `firebase init` or create manually with your project ID (required for `firebase deploy`) |
| **PWA icons absent** | 🟡 Warning | `public/icon-192.png`, `public/icon-512.png`, `public/favicon.svg` referenced in `vite.config.ts` but not present — app will load, PWA install prompt will be missing icon |
| **Photos stored as base64 in Firestore** | 🟡 Warning | `PhotoEntry.imageDataUrl` is raw base64. Firestore documents have a **1 MB limit**. A single photo will easily exceed this. Replace with Firebase Storage or GCS + store a download URL instead |
| **Claude API key in localStorage** | 🟡 Warning | `localStorage.getItem('claudeApiKey')` is visible to any JS on the page. Acceptable for a private family app; for production consider a Cloud Function proxy |
| **`enableIndexedDbPersistence` deprecated** | 🟢 Low | Newer Firestore SDK (v10+) prefers `initializeFirestore({ localCache: persistentLocalCache() })`. Functionality still works but a console warning appears |
| **No `firebase.indexes.json`** | 🟢 Low | Not currently needed (no composite queries), but add if you add sorting/filtering |
| **Default Vite README** | 🟢 Low | Now replaced by this file |

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- `npm` (or `pnpm` / `yarn`)
- A Firebase project (see [GCP / Firebase setup](#gcp--firebase-server-side-requirements))
- A Claude API key from [console.anthropic.com](https://console.anthropic.com) (only needed during setup to parse booking confirmations)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in your Firebase project credentials (all five VITE_FIREBASE_* variables).
See the [GCP section](#gcp--firebase-server-side-requirements) for where to get these values.

### 3. Start the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. First-time onboarding (in the app)

The app opens on the **Setup screen** (`/setup`) whenever no trip code is stored locally.

**Option A — Create a new trip (admin device)**

1. Click **"Create Trip"**
2. Enter a short trip code, e.g. `greece2026` (lowercase, no spaces)
3. Fill in trip name and family member names (English + Hebrew) and emojis
4. Click **"Create Trip"** → you'll move to the Upload screen
5. Paste your Claude API key (stored only in `localStorage`)
6. Upload booking confirmation screenshots or PDFs (flights, hotels, rental car)
7. Click **"Parse with Claude"** → Claude extracts the structured data and saves it to Firestore
8. Click **"Save"** → you land on the Home screen

**Option B — Join an existing trip (family member device)**

1. Click **"Join Trip"**
2. Enter the trip code the admin shared (e.g. `greece2026`)
3. Tap **Join** → data loads from Firestore in real time

---

## Populating Trip Data

### Automatic (recommended) — booking confirmations → Claude AI

During setup (step 4 → 7 above), upload screenshots or PDFs of:

- Flight confirmation emails
- Hotel booking confirmations
- Rental car confirmation

Claude will extract flights, hotels, and rental cars and write them to Firestore.
The prompt is in `src/pages/SetupPage.tsx:138` — you can edit it to extract more fields.

> **Tip:** Upload all confirmations at once (multi-select). Claude handles up to ~20 images per request.

### Manual — via Firestore console

For highlights, restaurants, quiz questions, and packing lists (not covered by the AI parser):

1. Open [Firebase Console](https://console.firebase.google.com) → Firestore
2. Navigate to `trips/{your-trip-code}/`
3. Add subcollection documents following the TypeScript types in `src/types/trip.ts`

**Example — adding a highlight:**
```json
// Collection: trips/greece2026/highlights
// Document ID: highlight-1
{
  "id": "highlight-1",
  "dayIndex": 2,
  "name": "Acropolis",
  "nameHe": "האקרופוליס",
  "category": "ruins",
  "address": "Athens 105 58",
  "mapUrl": "https://maps.google.com/?q=Acropolis",
  "completed": false
}
```

**Example — adding a restaurant:**
```json
// Collection: trips/greece2026/restaurants
{
  "id": "rest-1",
  "name": "Taverna Platanos",
  "nameHe": "טברנה פלאטנוס",
  "cuisine": "Greek",
  "city": "Athens",
  "priceRange": "$$",
  "ratings": {},
  "visited": false
}
```

**Example — adding a quiz question:**
```json
// Collection: trips/greece2026/quizQuestions  ← note: add this subcollection manually
{
  "id": "q-1",
  "dayIndex": 0,
  "question": "How many islands does Greece have?",
  "questionHe": "כמה איים יש ביוון?",
  "options": ["~800", "~1200", "~6000", "~250"],
  "optionsHe": ["~800", "~1200", "~6000", "~250"],
  "correctIndex": 2,
  "funFact": "Greece has approximately 6,000 islands, of which about 227 are inhabited.",
  "funFactHe": "ביוון כ-6,000 איים, מהם כ-227 מיושבים."
}
```

### Seed script (optional)

If you have your trip data in JSON, you can seed Firestore with a small Node script using the Firebase Admin SDK:

```bash
npm install -D firebase-admin
```

```js
// seed.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({ credential: cert('./serviceAccountKey.json') });
const db = getFirestore(app);
const TRIP_CODE = 'greece2026';

const highlights = [ /* your data */ ];

for (const h of highlights) {
  await db.doc(`trips/${TRIP_CODE}/highlights/${h.id}`).set(h);
  console.log('wrote', h.id);
}
```

```bash
node seed.mjs
```

---

## GCP / Firebase Server-Side Requirements

This app uses **Firebase** (which runs on Google Cloud) for all server-side functionality.
There is **no custom backend server** — everything is Firestore + Anonymous Auth + Firebase Hosting.

### Step 1 — Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. **Add project** → name it (e.g. `family-trip-app`)
3. Disable Google Analytics (optional for this use case) → **Create**

### Step 2 — Enable Firestore

1. In the Firebase console → **Build → Firestore Database**
2. Click **Create database**
3. Choose **"Start in production mode"** (rules are already written in `firestore.rules`)
4. Select a region close to you (e.g. `europe-west1` for Israel)

### Step 3 — Enable Anonymous Authentication

1. **Build → Authentication → Get started**
2. **Sign-in method** tab → enable **Anonymous**

### Step 4 — Register the web app & get config

1. **Project Overview** → click the `</>` web icon → **Add app**
2. Register app name (e.g. `family-trip-web`) — you don't need Firebase Hosting checked here yet
3. Copy the `firebaseConfig` object — map it to your `.env`:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### Step 5 — Deploy Firestore security rules

Install Firebase CLI if needed:

```bash
npm install -g firebase-tools
firebase login
```

Create `.firebaserc` in the project root:

```json
{
  "projects": {
    "default": "your-project-id"
  }
}
```

Deploy rules:

```bash
firebase deploy --only firestore:rules
```

### Step 6 — Build and deploy the PWA

```bash
npm run build
firebase deploy --only hosting
```

Your app will be live at `https://your-project-id.web.app`.

### Optional GCP services

| Service | When to add | How |
|---|---|---|
| **Firebase Storage** | When photos are added (current base64 approach will break at >1MB per photo) | Enable in Firebase Console → Storage; update `PhotoEntry` to store a `downloadUrl` instead of `imageDataUrl`; upload via `ref(storage, path).put(file)` |
| **Cloud Functions** | If you want to proxy the Claude API server-side (avoids exposing the API key in the browser) | `firebase init functions` → create an HTTPS function that calls Anthropic; call it from the setup page instead of calling Anthropic directly |
| **App Check** | If the app becomes public and you want to prevent abuse of your Firestore quota | Enable in Firebase Console → App Check → reCAPTCHA v3 |
| **Firebase Performance** | Optional — monitor load times | Add `firebase/performance` to `config.ts` |

### Summary of required Firebase services

```
Firebase Project
├── Firestore Database     ← trip data, real-time sync, offline cache
├── Authentication         ← Anonymous (no login required from family)
└── Hosting                ← serves the built PWA (dist/)
```

Cost: All three services are within the **Spark (free) tier** for a private family app.
Firestore free tier: 1 GB storage, 50K reads/day, 20K writes/day, 20K deletes/day.

---

## Project Structure

```
family-trip-app/
├── src/
│   ├── App.tsx                   # Root router — redirects to /setup if no tripCode
│   ├── main.tsx                  # React entry point
│   ├── index.css                 # Global styles
│   ├── components/
│   │   └── Layout.tsx            # Bottom nav + page shell
│   ├── context/
│   │   └── TripContext.tsx       # Global state + Firestore subscriptions
│   ├── firebase/
│   │   ├── config.ts             # Firebase init + Firestore offline persistence
│   │   └── tripService.ts        # All Firestore read/write functions
│   ├── i18n/
│   │   ├── en.ts                 # English strings
│   │   ├── he.ts                 # Hebrew strings
│   │   └── index.ts              # i18next setup
│   ├── pages/
│   │   ├── SetupPage.tsx         # Create/join trip; AI-parse booking confirmations
│   │   ├── HomePage.tsx          # Countdown + today's summary
│   │   ├── FlightsPage.tsx       # Flight cards per day
│   │   ├── HotelsPage.tsx        # Hotel details + check-in/out
│   │   ├── DrivingPage.tsx       # Rental car + driving segments
│   │   ├── HighlightsPage.tsx    # Attractions, tick-off per member
│   │   ├── RestaurantsPage.tsx   # Restaurant list + per-member ratings
│   │   ├── PassportPage.tsx      # Family member cards
│   │   ├── PhotosPage.tsx        # Photo sharing (base64 — see known issues)
│   │   ├── QuizPage.tsx          # Travel knowledge quiz
│   │   ├── PackingPage.tsx       # Shared + personal packing lists
│   │   └── SettingsPage.tsx      # Language, member selection, trip code
│   ├── types/
│   │   └── trip.ts               # TypeScript interfaces for all data types
│   └── vite-env.d.ts
├── public/                       # ← ADD icon-192.png, icon-512.png, favicon.svg here
├── firebase.json                 # Hosting + Firestore deploy config
├── firestore.rules               # Security rules (auth-gated)
├── .env.example                  # Environment variable template
├── vite.config.ts                # Vite + PWA plugin config
└── package.json
```

## Firestore Data Model

```
trips/{tripCode}                  ← TripConfig doc (name, dates, family members)
  ├── days/{dayIndex}             ← TripDay doc
  ├── flights/{flightId}          ← Flight docs
  ├── hotels/{hotelId}            ← Hotel docs
  ├── driving/{segmentId}         ← DrivingSegment docs
  ├── rentalCars/{carId}          ← RentalCar docs
  ├── highlights/{highlightId}    ← Highlight docs (completed per member)
  ├── restaurants/{restaurantId}  ← Restaurant docs (ratings per member)
  ├── packing/{itemId}            ← PackingItem docs (checked flag)
  ├── photos/{photoId}            ← PhotoEntry docs (base64 — see known issues)
  └── quizAnswers/{memberId_qId}  ← QuizAnswer docs
```

## Known Issues

1. **Photo size limit**: `PhotoEntry.imageDataUrl` stores raw base64 directly in Firestore. A typical phone photo (2–5 MB) will exceed Firestore's 1 MB document limit and silently fail. Migrate to Firebase Storage before adding real photos.

2. **Deprecated Firestore persistence API**: `enableIndexedDbPersistence()` is deprecated in Firestore SDK v10+. Replace in `src/firebase/config.ts` with:
   ```ts
   import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';
   export const db = initializeFirestore(app, { localCache: persistentLocalCache() });
   ```

3. **Claude API key in localStorage**: The key is visible in DevTools. Fine for a private family app; use a Cloud Function if you want to keep it server-side.

4. **No PWA icons**: Add `public/icon-192.png` and `public/icon-512.png` (192×192 and 512×512 PNGs) for the install prompt to show correctly.
