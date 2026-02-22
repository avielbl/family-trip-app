import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { signInAnonymously } from 'firebase/auth';
import { db, auth, storage } from './config';
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
  DiaryNote,
} from '../types/trip';

// Auth
export async function joinTrip(tripCode: string): Promise<boolean> {
  await signInAnonymously(auth);
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

// Diary Notes
export async function saveDiaryNote(tripCode: string, dayIndex: number, text: string): Promise<void> {
  await setDoc(doc(db, 'trips', tripCode, 'diary', String(dayIndex)), { dayIndex, text });
}

export function subscribeDiaryNotes(
  tripCode: string,
  callback: (notes: DiaryNote[]) => void
): Unsubscribe {
  const colRef = collection(db, 'trips', tripCode, 'diary');
  return onSnapshot(colRef, (snap) => {
    callback(snap.docs.map((d) => d.data() as DiaryNote));
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
