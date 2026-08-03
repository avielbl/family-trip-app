export interface TripConfig {
  tripCode: string;
  tripName: string;
  startDate: string; // ISO date
  endDate: string;
  familyMembers: FamilyMember[];
  adminUid?: string; // UID of admin user (set when admin first signs in)
  familyId?: string; // back-reference to families/{familyId}
  destination?: string; // e.g. "Greece"
  destinationHe?: string;
  countryCode?: string; // ISO 3166-1 alpha-2, e.g. "GR" (map queries)
  flagEmoji?: string; // e.g. "🇬🇷"
  status?: TripStatus;
  createdAt?: string;
}

export type TripStatus = 'draft' | 'upcoming' | 'active' | 'archived';

// The shared "home" that outlives any single trip. Holds the member roster
// template and — critically — which trip is the family-wide active one.
export interface Family {
  id: string;
  name: string;
  adminUids: string[];
  memberTemplates: FamilyMember[]; // prefill source for new trips
  memberEmails?: string[]; // denormalized (lowercased) for sign-in recovery lookup
  tripCodes: string[]; // newest first
  activeTripCode: string | null;
  createdAt: string;
}

// Lightweight card data for the trip manager (derived from TripConfig)
export interface TripSummary {
  tripCode: string;
  tripName: string;
  destination?: string;
  destinationHe?: string;
  flagEmoji?: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  memberCount: number;
}

export interface FamilyMember {
  id: string;
  name: string;
  nameHe: string;
  emoji: string; // avatar emoji
  deviceType: 'phone' | 'tablet';
  email?: string;      // for Google-auth matching
  isVirtual?: boolean; // true for shared-tablet kids
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  tripCode?: string; // legacy single-trip pointer (kept for migration)
  familyId?: string;
  lastViewedTripCode?: string;
  memberId?: string; // matched FamilyMember.id
  createdAt: string;
}

export interface ContentBlock {
  id: string;
  type: 'text' | 'photo';
  content?: string;    // text content (for type='text')
  contentHe?: string;
  imageUrl?: string;   // Firebase Storage URL (for type='photo')
  caption?: string;
  captionHe?: string;
  order: number;
}

export interface TravelLogEntry {
  id: string;
  dayIndex: number;
  title: string;
  titleHe?: string;
  location: string;
  blocks: ContentBlock[];
  generatedAt?: string;
  updatedAt: string;
}

export interface Flight {
  id: string;
  dayIndex: number;
  airline: string;
  flightNumber: string;
  departureAirport: string;
  departureAirportCode: string;
  arrivalAirport: string;
  arrivalAirportCode: string;
  departureTime: string; // ISO datetime
  arrivalTime: string;
  terminal?: string;
  gate?: string;
  confirmationCode?: string;
  boardingPassUrl?: string;
  notes?: string;
}

export interface Hotel {
  id: string;
  dayIndexStart: number;
  dayIndexEnd: number;
  name: string;
  address: string;
  city: string;
  checkIn: string; // ISO datetime
  checkOut: string; // ISO datetime
  confirmationCode?: string;
  phone?: string;
  email?: string;
  wifiPassword?: string;
  mapUrl?: string;
  website?: string;
  lat?: number;
  lng?: number;
  notes?: string;
  imageUrl?: string;
}

export interface DrivingSegment {
  id: string;
  dayIndex: number;
  from: string;
  to: string;
  distanceKm?: number;
  durationMinutes?: number;
  mapUrl?: string;
  notes?: string;
}

export interface RentalCar {
  id: string;
  company: string;
  confirmationCode?: string;
  pickupLocation: string;
  pickupTime: string;
  returnLocation: string;
  returnTime: string;
  carType?: string;
  phone?: string;
  notes?: string;
}

export interface Highlight {
  id: string;
  dayIndex: number;
  name: string;
  nameHe?: string;
  description?: string;
  descriptionHe?: string;
  category: HighlightCategory;
  address?: string;
  openingHours?: string;
  ticketInfo?: string;
  mapUrl?: string;
  lat?: number;
  lng?: number;
  imageUrl?: string;
  completed: boolean;
  completedBy?: string[];
}

export type HighlightCategory =
  | 'beach'
  | 'ruins'
  | 'museum'
  | 'food'
  | 'kids-fun'
  | 'nature'
  | 'shopping'
  | 'viewpoint'
  | 'other';

export interface Restaurant {
  id: string;
  dayIndex?: number;
  name: string;
  nameHe?: string;
  cuisine?: string;
  address?: string;
  city?: string;
  phone?: string;
  mapUrl?: string;
  lat?: number;
  lng?: number;
  priceRange?: '$' | '$$' | '$$$';
  ratings: Record<string, number>; // memberId -> 1-5
  notes?: string;
  visited: boolean;
}

export interface PackingItem {
  id: string;
  text: string;
  textHe?: string;
  checked: boolean;
  category: 'shared' | string; // 'shared' or memberId
}

export interface PhotoEntry {
  id: string;
  dayIndex: number;
  memberId: string;
  imageUrl: string; // Firebase Storage download URL
  caption?: string;
  captionHe?: string;
  timestamp: string;
}

export interface QuizQuestion {
  id: string;
  dayIndex: number;
  question: string;
  questionHe: string;
  options: string[];
  optionsHe: string[];
  correctIndex: number;
  funFact: string;
  funFactHe: string;
}

export interface QuizAnswer {
  memberId: string;
  questionId: string;
  selectedIndex: number;
  correct: boolean;
}

// A single scheduled element of a day plan — activity, meal, or drive —
// with practical details and an approval flag (approved items appear on the map).
export interface PlanItem {
  id: string;
  kind: 'activity' | 'meal' | 'drive';
  name: string;
  nameHe?: string;
  startTime?: string; // "09:00"
  durationMinutes?: number;
  location?: string; // place or city (geocodable)
  lat?: number;
  lng?: number;
  website?: string;
  price?: string; // e.g. "€12 adult / €6 child" — AI values are approximate
  openingHours?: string;
  notes?: string;
  notesHe?: string;
  // drive-only:
  from?: string;
  to?: string;
  distanceKm?: number;
  approved?: boolean;
}

export interface DayPlan {
  items?: PlanItem[]; // structured plan (preferred)
  morning?: string[];
  morningHe?: string[];
  afternoon?: string[];
  afternoonHe?: string[];
  evening?: string[];
  eveningHe?: string[];
  restaurants?: string[];
  restaurantsHe?: string[];
  tips?: string;
  tipsHe?: string;
}

export interface TripDay {
  dayIndex: number; // 0-based
  date: string; // ISO date
  title: string;
  titleHe: string;
  location: string;
  locationHe?: string;
  plan?: DayPlan; // AI-generated / hand-edited day plan (any destination)
  flights: Flight[];
  hotels: Hotel[];
  driving: DrivingSegment[];
  highlights: Highlight[];
  restaurants: Restaurant[];
}

// Free-form trip notes — observations about attractions, restaurants, routes
// etc. that may affect planning. The AI assistant reads open notes and can
// propose route/plan amendments from them.
export interface TripNote {
  id: string;
  text: string;
  category: 'attraction' | 'restaurant' | 'hotel' | 'route' | 'general';
  relatedName?: string;
  createdBy?: string; // member id
  createdByName?: string;
  createdAt: string; // ISO
  status: 'open' | 'done';
}
