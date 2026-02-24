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
