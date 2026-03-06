import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  updateDoc,
  writeBatch,
  deleteDoc,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from './config';
import type {
  TripConfig,
  TripDay,
  Flight,
  Hotel,
  DrivingSegment,
  RentalCar,
  Highlight,
  Restaurant,
  PackingItem,
  PhotoEntry,
  QuizAnswer,
  TravelLogEntry,
} from '../types/trip';

export async function joinTrip(tripCode: string): Promise<boolean> {
  const tripRef = doc(db, 'trips', tripCode);
  const tripDoc = await getDoc(tripRef);
  return tripDoc.exists();
}

// Trip Config
export async function getTripConfig(tripCode: string): Promise<TripConfig | null> {
  const snap = await getDoc(doc(db, 'trips', tripCode));
  return snap.exists() ? (snap.data() as TripConfig) : null;
}

export async function saveTripConfig(config: TripConfig): Promise<void> {
  await setDoc(doc(db, 'trips', config.tripCode), config);
}

// Days
export async function saveTripDays(tripCode: string, days: TripDay[]): Promise<void> {
  const batch = writeBatch(db);
  for (const day of days) {
    const ref = doc(db, 'trips', tripCode, 'days', String(day.dayIndex));
    batch.set(ref, day);
  }
  await batch.commit();
}

export async function saveTripDay(tripCode: string, day: TripDay): Promise<void> {
  await setDoc(doc(db, 'trips', tripCode, 'days', String(day.dayIndex)), day);
}

export function subscribeTripDays(
  tripCode: string,
  callback: (days: TripDay[]) => void
): Unsubscribe {
  const colRef = collection(db, 'trips', tripCode, 'days');
  return onSnapshot(colRef, (snap) => {
    const days = snap.docs
      .map((d) => d.data() as TripDay)
      .sort((a, b) => a.dayIndex - b.dayIndex);
    callback(days);
  });
}

// Flights
export async function saveFlight(tripCode: string, flight: Flight): Promise<void> {
  await setDoc(doc(db, 'trips', tripCode, 'flights', flight.id), flight);
}

export function subscribeFlights(
  tripCode: string,
  callback: (flights: Flight[]) => void
): Unsubscribe {
  const colRef = collection(db, 'trips', tripCode, 'flights');
  return onSnapshot(colRef, (snap) => {
    callback(snap.docs.map((d) => d.data() as Flight));
  });
}

// Hotels
export async function saveHotel(tripCode: string, hotel: Hotel): Promise<void> {
  await setDoc(doc(db, 'trips', tripCode, 'hotels', hotel.id), hotel);
}

export function subscribeHotels(
  tripCode: string,
  callback: (hotels: Hotel[]) => void
): Unsubscribe {
  const colRef = collection(db, 'trips', tripCode, 'hotels');
  return onSnapshot(colRef, (snap) => {
    callback(snap.docs.map((d) => d.data() as Hotel));
  });
}

// Driving
export async function saveDrivingSegment(
  tripCode: string,
  segment: DrivingSegment
): Promise<void> {
  await setDoc(doc(db, 'trips', tripCode, 'driving', segment.id), segment);
}

export function subscribeDriving(
  tripCode: string,
  callback: (segments: DrivingSegment[]) => void
): Unsubscribe {
  const colRef = collection(db, 'trips', tripCode, 'driving');
  return onSnapshot(colRef, (snap) => {
    callback(snap.docs.map((d) => d.data() as DrivingSegment));
  });
}

// Rental Car
export async function saveRentalCar(tripCode: string, car: RentalCar): Promise<void> {
  await setDoc(doc(db, 'trips', tripCode, 'rentalCars', car.id), car);
}

export function subscribeRentalCars(
  tripCode: string,
  callback: (cars: RentalCar[]) => void
): Unsubscribe {
  const colRef = collection(db, 'trips', tripCode, 'rentalCars');
  return onSnapshot(colRef, (snap) => {
    callback(snap.docs.map((d) => d.data() as RentalCar));
  });
}

// Highlights
export async function saveHighlight(tripCode: string, h: Highlight): Promise<void> {
  await setDoc(doc(db, 'trips', tripCode, 'highlights', h.id), h);
}

export async function toggleHighlightComplete(
  tripCode: string,
  highlightId: string,
  memberId: string,
  completed: boolean
): Promise<void> {
  const ref = doc(db, 'trips', tripCode, 'highlights', highlightId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as Highlight;
  let completedBy = data.completedBy || [];
  if (completed) {
    completedBy = [...new Set([...completedBy, memberId])];
  } else {
    completedBy = completedBy.filter((id) => id !== memberId);
  }
  await updateDoc(ref, { completed: completedBy.length > 0, completedBy });
}

export function subscribeHighlights(
  tripCode: string,
  callback: (highlights: Highlight[]) => void
): Unsubscribe {
  const colRef = collection(db, 'trips', tripCode, 'highlights');
  return onSnapshot(colRef, (snap) => {
    callback(snap.docs.map((d) => d.data() as Highlight));
  });
}

// Restaurants
export async function saveRestaurant(tripCode: string, r: Restaurant): Promise<void> {
  await setDoc(doc(db, 'trips', tripCode, 'restaurants', r.id), r);
}

export async function rateRestaurant(
  tripCode: string,
  restaurantId: string,
  memberId: string,
  rating: number
): Promise<void> {
  const ref = doc(db, 'trips', tripCode, 'restaurants', restaurantId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as Restaurant;
  await updateDoc(ref, {
    ratings: { ...data.ratings, [memberId]: rating },
  });
}

export function subscribeRestaurants(
  tripCode: string,
  callback: (restaurants: Restaurant[]) => void
): Unsubscribe {
  const colRef = collection(db, 'trips', tripCode, 'restaurants');
  return onSnapshot(colRef, (snap) => {
    callback(snap.docs.map((d) => d.data() as Restaurant));
  });
}

// Packing Items
export async function savePackingItem(tripCode: string, item: PackingItem): Promise<void> {
  await setDoc(doc(db, 'trips', tripCode, 'packing', item.id), item);
}

export async function togglePackingItem(
  tripCode: string,
  itemId: string,
  checked: boolean
): Promise<void> {
  await updateDoc(doc(db, 'trips', tripCode, 'packing', itemId), { checked });
}

export function subscribePackingItems(
  tripCode: string,
  callback: (items: PackingItem[]) => void
): Unsubscribe {
  const colRef = collection(db, 'trips', tripCode, 'packing');
  return onSnapshot(colRef, (snap) => {
    callback(snap.docs.map((d) => d.data() as PackingItem));
  });
}

// Photos
export async function savePhoto(
  tripCode: string,
  photo: Omit<PhotoEntry, 'imageUrl'> & { imageDataUrl: string }
): Promise<void> {
  // Upload the image to Firebase Storage and store the URL in Firestore
  const storageRef = ref(storage, `trips/${tripCode}/photos/${photo.id}`);
  await uploadString(storageRef, photo.imageDataUrl, 'data_url');
  const imageUrl = await getDownloadURL(storageRef);

  const { imageDataUrl: _, ...photoMeta } = photo;
  await setDoc(doc(db, 'trips', tripCode, 'photos', photo.id), {
    ...photoMeta,
    imageUrl,
  });
}

export function subscribePhotos(
  tripCode: string,
  callback: (photos: PhotoEntry[]) => void
): Unsubscribe {
  const colRef = collection(db, 'trips', tripCode, 'photos');
  return onSnapshot(colRef, (snap) => {
    callback(snap.docs.map((d) => d.data() as PhotoEntry));
  });
}

// Quiz Answers
export async function saveQuizAnswer(tripCode: string, answer: QuizAnswer): Promise<void> {
  const id = `${answer.memberId}_${answer.questionId}`;
  await setDoc(doc(db, 'trips', tripCode, 'quizAnswers', id), answer);
}

export function subscribeQuizAnswers(
  tripCode: string,
  callback: (answers: QuizAnswer[]) => void
): Unsubscribe {
  const colRef = collection(db, 'trips', tripCode, 'quizAnswers');
  return onSnapshot(colRef, (snap) => {
    callback(snap.docs.map((d) => d.data() as QuizAnswer));
  });
}

// Delete helpers
export async function deleteFlight(tripCode: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'trips', tripCode, 'flights', id));
}

export async function deleteHotel(tripCode: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'trips', tripCode, 'hotels', id));
}

export async function deleteDrivingSegment(tripCode: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'trips', tripCode, 'driving', id));
}

export async function deleteRentalCar(tripCode: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'trips', tripCode, 'rentalCars', id));
}

export async function deleteHighlight(tripCode: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'trips', tripCode, 'highlights', id));
}

export async function deleteRestaurant(tripCode: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'trips', tripCode, 'restaurants', id));
}

export async function deletePackingItem(tripCode: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'trips', tripCode, 'packing', id));
}

// Travel Log
export async function saveTravelLogEntry(
  tripCode: string,
  entry: TravelLogEntry
): Promise<void> {
  await setDoc(doc(db, 'trips', tripCode, 'travelLog', entry.id), entry);
}

export async function deleteTravelLogEntry(tripCode: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'trips', tripCode, 'travelLog', id));
}

export function subscribeTravelLog(
  tripCode: string,
  callback: (entries: TravelLogEntry[]) => void
): Unsubscribe {
  const colRef = collection(db, 'trips', tripCode, 'travelLog');
  return onSnapshot(colRef, (snap) => {
    const entries = snap.docs
      .map((d) => d.data() as TravelLogEntry)
      .sort((a, b) => a.dayIndex - b.dayIndex);
    callback(entries);
  });
}

// AI Config (server-side persistence — admin writes, all users read)
export async function saveAIConfigToServer(
  tripCode: string,
  config: import('../types/ai').AIConfig
): Promise<void> {
  await setDoc(doc(db, 'trips', tripCode, 'settings', 'aiConfig'), config);
}

export async function loadAIConfigFromServer(
  tripCode: string
): Promise<import('../types/ai').AIConfig | null> {
  const snap = await getDoc(doc(db, 'trips', tripCode, 'settings', 'aiConfig'));
  return snap.exists() ? (snap.data() as import('../types/ai').AIConfig) : null;
}

// Passport Stamps
export function subscribePassportStamps(
  tripCode: string,
  callback: (stamps: import('../types/ai').PassportStamp[]) => void
): Unsubscribe {
  const colRef = collection(db, 'trips', tripCode, 'passportStamps');
  return onSnapshot(colRef, (snap) => {
    callback(snap.docs.map((d) => d.data() as import('../types/ai').PassportStamp));
  });
}

export async function savePassportStamp(
  tripCode: string,
  stamp: import('../types/ai').PassportStamp
): Promise<void> {
  await setDoc(doc(db, 'trips', tripCode, 'passportStamps', stamp.id), stamp);
}

export async function deletePassportStamp(tripCode: string, stampId: string): Promise<void> {
  await deleteDoc(doc(db, 'trips', tripCode, 'passportStamps', stampId));
}

export function subscribeEarnedStamps(
  tripCode: string,
  callback: (earned: import('../types/ai').EarnedStamp[]) => void
): Unsubscribe {
  const colRef = collection(db, 'trips', tripCode, 'earnedStamps');
  return onSnapshot(colRef, (snap) => {
    callback(snap.docs.map((d) => d.data() as import('../types/ai').EarnedStamp));
  });
}

export async function earnStamp(
  tripCode: string,
  memberId: string,
  stampId: string
): Promise<void> {
  const id = `${memberId}_${stampId}`;
  await setDoc(doc(db, 'trips', tripCode, 'earnedStamps', id), {
    id, stampId, memberId, earnedAt: new Date().toISOString(),
  });
}

// Bulk import (for parsed confirmation data)
export async function importTripData(
  tripCode: string,
  data: {
    config?: TripConfig;
    days?: TripDay[];
    flights?: Flight[];
    hotels?: Hotel[];
    driving?: DrivingSegment[];
    rentalCars?: RentalCar[];
    highlights?: Highlight[];
    restaurants?: Restaurant[];
    packing?: PackingItem[];
  }
): Promise<void> {
  if (data.config) await saveTripConfig(data.config);
  if (data.days) await saveTripDays(tripCode, data.days);

  const batchSave = async <T extends { id: string }>(
    items: T[] | undefined,
    subcollection: string
  ) => {
    if (!items?.length) return;
    const batch = writeBatch(db);
    for (const item of items) {
      batch.set(doc(db, 'trips', tripCode, subcollection, item.id), item as any);
    }
    await batch.commit();
  };

  await batchSave(data.flights, 'flights');
  await batchSave(data.hotels, 'hotels');
  await batchSave(data.driving, 'driving');
  await batchSave(data.rentalCars, 'rentalCars');
  await batchSave(data.highlights, 'highlights');
  await batchSave(data.restaurants, 'restaurants');
  await batchSave(data.packing, 'packing');
}

// ─── Auto-generate driving routes from hotels + flights ──────────────────────
// Rough Greece driving distances (km) between common cities
const ROUTE_DISTANCES: Record<string, { km: number; mins: number }> = {
  // Actual trip routes (March-April 2026)
  'thessaloniki-ioannina': { km: 310, mins: 210 },
  'ioannina-thessaloniki': { km: 310, mins: 210 },
  'thessaloniki-metsovo': { km: 230, mins: 160 },
  'metsovo-ioannina': { km: 80, mins: 60 },
  'ioannina-palaiosagiosaathanasios': { km: 280, mins: 180 },
  'ioannina-palaiosagios': { km: 280, mins: 180 },
  'palaiosagiosaathanasios-thessaloniki': { km: 170, mins: 120 },
  'palaiosagios-thessaloniki': { km: 170, mins: 120 },
  'edessa-thessaloniki': { km: 100, mins: 75 },
  'thessaloniki-edessa': { km: 100, mins: 75 },
  'ioannina-pozar': { km: 290, mins: 190 },
  'pozar-edessa': { km: 35, mins: 30 },
  // Legacy Greek routes
  'athens-delphi': { km: 180, mins: 150 },
  'athens-meteora': { km: 325, mins: 240 },
  'athens-nafplio': { km: 145, mins: 130 },
  'athens-olympia': { km: 320, mins: 210 },
  'athens-corinth': { km: 90, mins: 75 },
  'delphi-meteora': { km: 165, mins: 140 },
  'meteora-thessaloniki': { km: 230, mins: 180 },
  'nafplio-olympia': { km: 195, mins: 170 },
  'nafplio-athens': { km: 145, mins: 130 },
  'olympia-athens': { km: 320, mins: 210 },
};

function routeKey(from: string, to: string): string {
  const a = from.toLowerCase().replace(/[^a-z]/g, '');
  const b = to.toLowerCase().replace(/[^a-z]/g, '');
  return `${a}-${b}`;
}

function estimateRoute(from: string, to: string): { distanceKm: number; durationMinutes: number } {
  const fwd = routeKey(from, to);
  const rev = routeKey(to, from);
  if (ROUTE_DISTANCES[fwd]) return { distanceKm: ROUTE_DISTANCES[fwd].km, durationMinutes: ROUTE_DISTANCES[fwd].mins };
  if (ROUTE_DISTANCES[rev]) return { distanceKm: ROUTE_DISTANCES[rev].km, durationMinutes: ROUTE_DISTANCES[rev].mins };
  return { distanceKm: 150, durationMinutes: 120 }; // generic fallback
}

export async function autoGenerateDrivingRoutes(
  tripCode: string,
  hotels: Hotel[],
  flights: Flight[],
  existingSegments: DrivingSegment[]
): Promise<number> {
  if (!hotels.length) return 0;

  const sortedHotels = [...hotels].sort(
    (a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime()
  );
  const sortedFlights = [...flights].sort(
    (a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime()
  );

  const segments: DrivingSegment[] = [];

  // Airport arrival → first hotel
  if (sortedFlights.length > 0) {
    const firstFlight = sortedFlights[0];
    const arrivalCity = firstFlight.arrivalAirport || firstFlight.arrivalAirportCode;
    const firstHotel = sortedHotels[0];
    const from = `${arrivalCity} Airport`;
    const to = `${firstHotel.name}, ${firstHotel.city}`;
    const alreadyExists = existingSegments.some(
      (s) => s.from.toLowerCase().includes(firstFlight.arrivalAirportCode.toLowerCase()) &&
               s.to.toLowerCase().includes(firstHotel.city.toLowerCase())
    );
    if (!alreadyExists) {
      const est = estimateRoute(arrivalCity, firstHotel.city);
      segments.push({
        id: `auto-arrival-${Date.now()}`,
        dayIndex: firstFlight.dayIndex,
        from,
        to,
        distanceKm: est.distanceKm,
        durationMinutes: est.durationMinutes,
        notes: 'Auto-generated: airport arrival transfer',
      });
    }
  }

  // Hotel → Hotel transitions
  for (let i = 0; i < sortedHotels.length - 1; i++) {
    const h1 = sortedHotels[i];
    const h2 = sortedHotels[i + 1];
    const from = `${h1.name}, ${h1.city}`;
    const to = `${h2.name}, ${h2.city}`;
    const alreadyExists = existingSegments.some(
      (s) => s.from.toLowerCase().includes(h1.city.toLowerCase()) &&
               s.to.toLowerCase().includes(h2.city.toLowerCase())
    );
    if (!alreadyExists) {
      const checkOutDayIndex = h1.dayIndexEnd;
      const est = estimateRoute(h1.city, h2.city);
      segments.push({
        id: `auto-hotel-${i}-${Date.now()}`,
        dayIndex: checkOutDayIndex,
        from,
        to,
        distanceKm: est.distanceKm,
        durationMinutes: est.durationMinutes,
        notes: `Auto-generated: ${h1.city} → ${h2.city}`,
      });
    }
  }

  // Last hotel → departure airport
  if (sortedFlights.length > 0) {
    const lastFlight = sortedFlights[sortedFlights.length - 1];
    const lastHotel = sortedHotels[sortedHotels.length - 1];
    const departureCity = lastFlight.departureAirport || lastFlight.departureAirportCode;
    const from = `${lastHotel.name}, ${lastHotel.city}`;
    const to = `${departureCity} Airport`;
    const alreadyExists = existingSegments.some(
      (s) => s.from.toLowerCase().includes(lastHotel.city.toLowerCase()) &&
               s.to.toLowerCase().includes(lastFlight.departureAirportCode.toLowerCase())
    );
    if (!alreadyExists) {
      const est = estimateRoute(lastHotel.city, departureCity);
      segments.push({
        id: `auto-departure-${Date.now()}`,
        dayIndex: lastFlight.dayIndex,
        from,
        to,
        distanceKm: est.distanceKm,
        durationMinutes: est.durationMinutes,
        notes: 'Auto-generated: departure airport transfer',
      });
    }
  }

  for (const seg of segments) {
    await saveDrivingSegment(tripCode, seg);
  }
  return segments.length;
}

// ─── Seed trip content (highlights, restaurants, driving, days) ───────────────
// Populates Firestore with the actual Greece 2026 trip plan content.
// Safe to run multiple times — uses fixed IDs so existing docs are overwritten.
export async function seedTripData(tripCode: string): Promise<{ highlights: number; restaurants: number; driving: number; days: number }> {
  const highlights: Highlight[] = [
    // Day 1 — Ioannina
    {
      id: 'hl-ioannina-castle',
      dayIndex: 1,
      name: "Its Kale (Ioannina Fortress)",
      nameHe: 'מצודת איטס קאלה (יואנינה)',
      description: 'Byzantine inner fortress on the shores of Pamvotis Lake. Home to Ali Pasha Museum.',
      descriptionHe: 'מבצר ביזנטי פנימי על שפת אגם פמבוטיס. בית המוזיאון של עלי פאשה.',
      category: 'ruins',
      address: 'Its Kale, Ioannina 453 33',
      lat: 39.6622, lng: 20.8527,
      completed: false,
    },
    {
      id: 'hl-pamvotis-island',
      dayIndex: 1,
      name: 'Pamvotis Lake Island',
      nameHe: 'האי באגם פמבוטיס',
      description: 'Car-free island reached by rowboat. Monastery where Ali Pasha was killed in 1822.',
      descriptionHe: 'אי ללא מכוניות נגיש בסירה. מנזר שם נרצח עלי פאשה ב-1822.',
      category: 'other',
      address: 'Pamvotis Lake Island, Ioannina',
      lat: 39.6570, lng: 20.8417,
      completed: false,
    },
    // Day 2 — Zagoria / Kipi bridges
    {
      id: 'hl-kipi-bridges',
      dayIndex: 2,
      name: 'Kipi Stone Bridges (Kokkoris & Kalogeriko)',
      nameHe: 'גשרי האבן קיפוי (קוקוריס וקלוגריקו)',
      description: '18th-century single-arch and triple-arch stone bridges in the Zagori region.',
      descriptionHe: 'גשרי אבן חד-קשת ותלת-קשת מהמאה ה-18 באזור זגורי.',
      category: 'other',
      address: 'Kipi, Zagori 440 07',
      lat: 39.8640, lng: 20.7380,
      completed: false,
    },
    {
      id: 'hl-oxia-viewpoint',
      dayIndex: 2,
      name: 'Oxia Viewpoint — Vikos Gorge',
      nameHe: 'נקודת תצפית אוקסיה – גיא ויקוס',
      description: 'Panoramic viewpoint over Vikos Gorge, one of the deepest canyons in the world relative to its width.',
      descriptionHe: 'נקודת תצפית פנורמית על גיא ויקוס, אחד העמוקים בעולם ביחס לרוחבו.',
      category: 'viewpoint',
      address: 'Oxia, Monodendri, Zagori',
      lat: 39.8985, lng: 20.7200,
      completed: false,
    },
    // Day 3 — Voidomatis & Papigo
    {
      id: 'hl-voidomatis-river',
      dayIndex: 3,
      name: 'Voidomatis River Trail',
      nameHe: 'מסלול נהר ווידומאטיס',
      description: 'Crystal-clear turquoise river fed by the Pindus mountains. One of the clearest rivers in Europe.',
      descriptionHe: 'נהר טורקיז צלול שמוזן מהרי פינדוס. אחד הנהרות הצלולים ביותר באירופה.',
      category: 'nature',
      address: 'Voidomatis River, Kleidonia, Zagori',
      lat: 39.9050, lng: 20.7650,
      completed: false,
    },
    {
      id: 'hl-papigo-rogovo',
      dayIndex: 3,
      name: 'Rogovo Pools (Papigo)',
      nameHe: 'בריכות רוגובו (פפיגו)',
      description: 'Natural rock pools carved by the river near Mikro Papigo village.',
      descriptionHe: 'בריכות סלע טבעיות שגולפו ע"י הנחל ליד כפר מיקרו פפיגו.',
      category: 'nature',
      address: 'Mikro Papigo, Zagori',
      lat: 39.9880, lng: 20.7240,
      completed: false,
    },
    // Day 4 — Kipina Monastery
    {
      id: 'hl-kipina-monastery',
      dayIndex: 4,
      name: 'Kipina Cave Monastery',
      nameHe: 'מנזר מערת קיפינה',
      description: 'Dramatic monastery carved directly into a cliff face. Active monastery accessible via rope bridge.',
      descriptionHe: 'מנזר דרמטי חצוב ישירות בפני צוק. מנזר פעיל נגיש דרך גשר חבל.',
      category: 'other',
      address: 'Kipina, Tsoumerka, Arta regional unit',
      lat: 39.4720, lng: 21.0540,
      completed: false,
    },
    // Day 6 — Pozar
    {
      id: 'hl-pozar-baths',
      dayIndex: 6,
      name: 'Pozar Thermal Baths',
      nameHe: 'בריכות החמות פוזאר',
      description: 'Outdoor thermal pools (~37°C) fed by natural hot springs, alongside a waterfall. Near Loutraki village.',
      descriptionHe: 'בריכות חמות חיצוניות (~37°C) מוזנות מעיינות טבעיים, לצד מפל. ליד כפר לוטרקי.',
      category: 'nature',
      address: 'Loutraki, Aridaia 584 00',
      lat: 40.9670, lng: 22.0430,
      completed: false,
    },
    // Day 7 — Edessa
    {
      id: 'hl-edessa-waterfalls',
      dayIndex: 7,
      name: 'Edessa Waterfalls',
      nameHe: 'מפלי אדסה',
      description: 'Multiple waterfalls cascading into a gorge. The main waterfall drops 70m — one of Greece\'s most impressive.',
      descriptionHe: 'מספר מפלים שצוללים לגיא. המפל הראשי צונח 70 מ\' – אחד המרשימים ביוון.',
      category: 'nature',
      address: 'Waterfalls Park, Edessa 582 00',
      lat: 40.8005, lng: 22.0510,
      completed: false,
    },
    // Day 8 — Thessaloniki waterfront
    {
      id: 'hl-nea-paralia',
      dayIndex: 8,
      name: 'Nea Paralia & Umbrellas Sculpture',
      nameHe: 'נאה פראליה ופסל המטריות',
      description: '3.5km waterfront promenade with gardens and sculptures, including the iconic Umbrellas sculpture.',
      descriptionHe: 'טיילת 3.5 ק"מ עם גנים ופסלים, כולל פסל המטריות האייקוני.',
      category: 'viewpoint',
      address: 'Nea Paralia, Thessaloniki',
      lat: 40.6306, lng: 22.9394,
      completed: false,
    },
    // Day 9 — NOESIS
    {
      id: 'hl-noesis-museum',
      dayIndex: 9,
      name: 'NOESIS Science Center & Technology Museum',
      nameHe: 'מרכז המדע והטכנולוגיה נואסיס',
      description: 'Interactive science museum with planetarium, vintage aircraft, and hands-on exhibits for all ages.',
      descriptionHe: 'מוזיאון מדע אינטראקטיבי עם פלנטריום, מטוסים ישנים ותערוכות חוויתיות לכל הגילאים.',
      category: 'museum',
      address: '6th km Thessaloniki-Thermi Road, Thermi 570 01',
      lat: 40.5896, lng: 22.9959,
      completed: false,
    },
    // Day 10 — Thessaloniki
    {
      id: 'hl-white-tower',
      dayIndex: 10,
      name: 'White Tower of Thessaloniki',
      nameHe: 'מגדל הלבן של סלוניקי',
      description: 'Iconic 15th-century Ottoman tower on the waterfront, now a museum of Thessaloniki\'s history.',
      descriptionHe: 'מגדל עות\'מאני אייקוני מהמאה ה-15 על הטיילת, כיום מוזיאון להיסטוריה של סלוניקי.',
      category: 'museum',
      address: 'White Tower, Thessaloniki Waterfront',
      lat: 40.6264, lng: 22.9480,
      completed: false,
    },
    {
      id: 'hl-modiano-market',
      dayIndex: 10,
      name: 'Modiano Market',
      nameHe: 'שוק מודיאנו',
      description: 'Historic covered food market. Fresh produce, olives, local cheeses, spices and street food.',
      descriptionHe: 'שוק מכוסה היסטורי. תוצרת טרייה, זיתים, גבינות מקומיות, תבלינים ואוכל רחוב.',
      category: 'shopping',
      address: 'Modiano Market, Thessaloniki city centre',
      lat: 40.6349, lng: 22.9394,
      completed: false,
    },
    {
      id: 'hl-pirate-boat',
      dayIndex: 10,
      name: 'Pirate Ship Bay Tour',
      nameHe: 'סיור סירת פיראטים במפרץ',
      description: 'Family-friendly cruise in the Thermaic Gulf with views of the Thessaloniki skyline and Mount Olympus.',
      descriptionHe: 'שייט ידידותי למשפחה במפרץ הטרמאיקוס עם נוף לקו האופק של סלוניקי ולהר אולימפוס.',
      category: 'kids-fun',
      address: 'Thessaloniki Port (near White Tower)',
      lat: 40.6270, lng: 22.9390,
      completed: false,
    },
  ];

  const restaurants: Restaurant[] = [
    {
      id: 'rst-gastra-ioannina',
      name: 'Gastra',
      nameHe: 'גסטרה',
      cuisine: 'Traditional Epirote',
      city: 'Ioannina',
      address: 'Old Bazaar, Ioannina',
      dayIndex: 1,
      priceRange: '$$',
      ratings: {},
      visited: false,
      notes: 'Best traditional Epirote cuisine in the old bazaar area',
    },
    {
      id: 'rst-ladadika',
      name: 'Ladadika Neighbourhood Tavernas',
      nameHe: 'טברנות שכונת לדדיקה',
      cuisine: 'Greek',
      city: 'Thessaloniki',
      address: 'Ladadika, Thessaloniki',
      dayIndex: 8,
      priceRange: '$$',
      ratings: {},
      visited: false,
      notes: 'Ottoman-era warehouses turned restaurants — nightlife hub of Thessaloniki',
    },
    {
      id: 'rst-tsinari',
      name: 'Tsinari',
      nameHe: 'צינארי',
      cuisine: 'Mezze',
      city: 'Thessaloniki',
      address: 'Tsimiski area, Thessaloniki',
      dayIndex: 8,
      priceRange: '$$',
      ratings: {},
      visited: false,
      notes: 'Great mezze on the Thessaloniki waterfront',
    },
    {
      id: 'rst-myrsini',
      name: 'Myrsini',
      nameHe: 'מירסיני',
      cuisine: 'Traditional Northern Greek',
      city: 'Thessaloniki',
      address: 'Thessaloniki city centre',
      dayIndex: 10,
      priceRange: '$$',
      ratings: {},
      visited: false,
    },
    {
      id: 'rst-trigona-elenidis',
      name: 'Trigona Elenidis',
      nameHe: 'טריגונה אלנידיס',
      cuisine: 'Pastry / Dessert',
      city: 'Thessaloniki',
      address: 'Thessaloniki city centre',
      dayIndex: 10,
      priceRange: '$',
      ratings: {},
      visited: false,
      notes: 'Famous for the local Thessaloniki trigona pastries — a must-try',
    },
  ];

  const driving: DrivingSegment[] = [
    {
      id: 'drv-skg-ioannina',
      dayIndex: 0,
      from: 'Thessaloniki Airport (SKG)',
      to: 'Selin Luxury Residences, Ioannina',
      distanceKm: 310,
      durationMinutes: 210,
      notes: 'Via Metsovo (Egnatia Odos). Stop in Metsovo for lunch and cheese shopping.',
    },
    {
      id: 'drv-ioannina-palaios',
      dayIndex: 5,
      from: 'Selin Luxury Residences, Ioannina',
      to: 'Palaios Agios Athanasios',
      distanceKm: 280,
      durationMinutes: 180,
      notes: 'Northern route via Florina region. Scenic mountain drive.',
    },
    {
      id: 'drv-edessa-thessaloniki',
      dayIndex: 7,
      from: 'Edessa Waterfalls',
      to: 'Thessaloniki Center Superior Apartment, Tsimiski 126',
      distanceKm: 100,
      durationMinutes: 75,
      notes: 'Short drive after morning at the waterfalls.',
    },
    {
      id: 'drv-thessaloniki-skgdep',
      dayIndex: 11,
      from: 'Thessaloniki Center Superior Apartment, Tsimiski 126',
      to: 'Thessaloniki Airport (SKG)',
      distanceKm: 16,
      durationMinutes: 25,
      notes: 'Return rental car. Arrive 2 hours before departure.',
    },
  ];

  const days: TripDay[] = [
    { dayIndex: 0, date: '2026-03-24', title: 'Arrival & Drive to Ioannina', titleHe: 'הגעה ונסיעה ליואנינה', location: 'Thessaloniki → Ioannina', locationHe: 'סלוניקי → יואנינה', flights: [], hotels: [], driving: [], highlights: [], restaurants: [] },
    { dayIndex: 1, date: '2026-03-25', title: 'Independence Day — Ioannina', titleHe: 'יום העצמאות – יואנינה', location: 'Ioannina', locationHe: 'יואנינה', flights: [], hotels: [], driving: [], highlights: [], restaurants: [] },
    { dayIndex: 2, date: '2026-03-26', title: 'Zagoria — Stone Bridges & Canyon', titleHe: 'זגוריה – גשרי אבן וגיא ויקוס', location: 'Zagoria', locationHe: 'זגוריה', flights: [], hotels: [], driving: [], highlights: [], restaurants: [] },
    { dayIndex: 3, date: '2026-03-27', title: 'Zagoria — Voidomatis & Papigo', titleHe: 'זגוריה – ווידומאטיס ופפיגו', location: 'Zagoria (Papigo)', locationHe: 'זגוריה (פפיגו)', flights: [], hotels: [], driving: [], highlights: [], restaurants: [] },
    { dayIndex: 4, date: '2026-03-28', title: 'Tsoumerka — Kipina Monastery', titleHe: 'צומרקה – מנזר קיפינה', location: 'Tsoumerka', locationHe: 'צומרקה', flights: [], hotels: [], driving: [], highlights: [], restaurants: [] },
    { dayIndex: 5, date: '2026-03-29', title: 'Drive to Palaios Agios Athanasios', titleHe: 'נסיעה לפלאיוס אגיוס אתנאסיוס', location: 'Ioannina → Palaios Agios Athanasios', locationHe: 'יואנינה → פלאיוס אגיוס אתנאסיוס', flights: [], hotels: [], driving: [], highlights: [], restaurants: [] },
    { dayIndex: 6, date: '2026-03-30', title: 'Pozar Thermal Baths', titleHe: 'בריכות החמות פוזאר', location: 'Pozar / Loutraki', locationHe: 'פוזאר / לוטרקי', flights: [], hotels: [], driving: [], highlights: [], restaurants: [] },
    { dayIndex: 7, date: '2026-03-31', title: 'Edessa Waterfalls → Thessaloniki', titleHe: 'מפלי אדסה → סלוניקי', location: 'Edessa → Thessaloniki', locationHe: 'אדסה → סלוניקי', flights: [], hotels: [], driving: [], highlights: [], restaurants: [] },
    { dayIndex: 8, date: '2026-04-01', title: 'Thessaloniki Waterfront & Ladadika', titleHe: 'טיילת סלוניקי ולדדיקה', location: 'Thessaloniki', locationHe: 'סלוניקי', flights: [], hotels: [], driving: [], highlights: [], restaurants: [] },
    { dayIndex: 9, date: '2026-04-02', title: 'NOESIS Science Museum & Cosmos Mall', titleHe: 'מוזיאון נואסיס וקוסמוס מול', location: 'Thessaloniki', locationHe: 'סלוניקי', flights: [], hotels: [], driving: [], highlights: [], restaurants: [] },
    { dayIndex: 10, date: '2026-04-03', title: 'White Tower, Modiano & Pirate Boat', titleHe: 'מגדל לבן, מודיאנו וסירת פיראטים', location: 'Thessaloniki', locationHe: 'סלוניקי', flights: [], hotels: [], driving: [], highlights: [], restaurants: [] },
    { dayIndex: 11, date: '2026-04-04', title: 'Departure from Thessaloniki', titleHe: 'עזיבה מסלוניקי', location: 'Thessaloniki (SKG)', locationHe: 'סלוניקי (SKG)', flights: [], hotels: [], driving: [], highlights: [], restaurants: [] },
  ];

  const hotel1: Hotel = {
    id: 'hotel-selin-ioannina',
    dayIndexStart: 0,
    dayIndexEnd: 4,
    name: 'Selin Luxury Residences',
    address: 'Ioannina, Epirus',
    city: 'Ioannina',
    checkIn: '2026-03-24T15:00:00',
    checkOut: '2026-03-29T11:00:00',
    lat: 39.6650, lng: 20.8550,
  };

  const hotel2: Hotel = {
    id: 'hotel-palaios-boutique',
    dayIndexStart: 5,
    dayIndexEnd: 6,
    name: 'Palaios Agios Athanasios Guesthouse',
    address: 'Palaios Agios Athanasios, Imathia',
    city: 'Palaios Agios Athanasios',
    checkIn: '2026-03-29T15:00:00',
    checkOut: '2026-03-31T11:00:00',
    lat: 40.8810, lng: 22.1460,
  };

  const hotel3: Hotel = {
    id: 'hotel-thessaloniki-tsimiski',
    dayIndexStart: 7,
    dayIndexEnd: 11,
    name: 'Thessaloniki Center Superior Apartment',
    address: 'Tsimiski 126, Thessaloniki',
    city: 'Thessaloniki',
    checkIn: '2026-03-31T15:00:00',
    checkOut: '2026-04-04T11:00:00',
    lat: 40.6341, lng: 22.9440,
  };

  // Batch write everything
  const batch = writeBatch(db);

  for (const h of highlights) {
    batch.set(doc(db, 'trips', tripCode, 'highlights', h.id), h);
  }
  for (const r of restaurants) {
    batch.set(doc(db, 'trips', tripCode, 'restaurants', r.id), r);
  }
  for (const d of driving) {
    batch.set(doc(db, 'trips', tripCode, 'driving', d.id), d);
  }
  for (const d of days) {
    batch.set(doc(db, 'trips', tripCode, 'days', String(d.dayIndex)), d);
  }
  for (const hotel of [hotel1, hotel2, hotel3]) {
    batch.set(doc(db, 'trips', tripCode, 'hotels', hotel.id), hotel);
  }

  await batch.commit();

  return {
    highlights: highlights.length,
    restaurants: restaurants.length,
    driving: driving.length,
    days: days.length,
  };
}
