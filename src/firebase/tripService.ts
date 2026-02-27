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
