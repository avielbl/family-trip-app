import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
  FamilyMember,
} from '../types/trip';
import {
  subscribeTripDays,
  subscribeFlights,
  subscribeHotels,
  subscribeDriving,
  subscribeRentalCars,
  subscribeHighlights,
  subscribeRestaurants,
  subscribePackingItems,
  subscribePhotos,
  subscribeQuizAnswers,
  getTripConfig,
  joinTrip,
} from '../firebase/tripService';

interface TripContextType {
  tripCode: string | null;
  config: TripConfig | null;
  currentMember: FamilyMember | null;
  days: TripDay[];
  flights: Flight[];
  hotels: Hotel[];
  driving: DrivingSegment[];
  rentalCars: RentalCar[];
  highlights: Highlight[];
  restaurants: Restaurant[];
  packingItems: PackingItem[];
  photos: PhotoEntry[];
  quizAnswers: QuizAnswer[];
  loading: boolean;
  error: string | null;
  setTripCode: (code: string) => Promise<boolean>;
  setCurrentMember: (member: FamilyMember) => void;
  todayDayIndex: number;
  daysUntilTrip: number;
  tripStarted: boolean;
  tripEnded: boolean;
}

const TripContext = createContext<TripContextType | null>(null);

export function useTripContext() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTripContext must be used within TripProvider');
  return ctx;
}

export function TripProvider({ children }: { children: React.ReactNode }) {
  const [tripCode, setTripCodeState] = useState<string | null>(
    localStorage.getItem('tripCode')
  );
  const [config, setConfig] = useState<TripConfig | null>(null);
  const [currentMember, setCurrentMemberState] = useState<FamilyMember | null>(null);
  const [days, setDays] = useState<TripDay[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [driving, setDriving] = useState<DrivingSegment[]>([]);
  const [rentalCars, setRentalCars] = useState<RentalCar[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [packingItems, setPackingItems] = useState<PackingItem[]>([]);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore member from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('currentMember');
    if (saved) {
      try {
        setCurrentMemberState(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const setCurrentMember = useCallback((member: FamilyMember) => {
    setCurrentMemberState(member);
    localStorage.setItem('currentMember', JSON.stringify(member));
  }, []);

  const handleSetTripCode = useCallback(async (code: string): Promise<boolean> => {
    try {
      const exists = await joinTrip(code);
      if (exists) {
        setTripCodeState(code);
        localStorage.setItem('tripCode', code);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to join trip:', err);
      return false;
    }
  }, []);

  // Subscribe to all data when tripCode is set
  useEffect(() => {
    if (!tripCode) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubs: (() => void)[] = [];

    getTripConfig(tripCode).then((cfg) => {
      setConfig(cfg);
      setLoading(false);
    }).catch((err) => {
      setError(err.message);
      setLoading(false);
    });

    unsubs.push(subscribeTripDays(tripCode, setDays));
    unsubs.push(subscribeFlights(tripCode, setFlights));
    unsubs.push(subscribeHotels(tripCode, setHotels));
    unsubs.push(subscribeDriving(tripCode, setDriving));
    unsubs.push(subscribeRentalCars(tripCode, setRentalCars));
    unsubs.push(subscribeHighlights(tripCode, setHighlights));
    unsubs.push(subscribeRestaurants(tripCode, setRestaurants));
    unsubs.push(subscribePackingItems(tripCode, setPackingItems));
    unsubs.push(subscribePhotos(tripCode, setPhotos));
    unsubs.push(subscribeQuizAnswers(tripCode, setQuizAnswers));

    return () => unsubs.forEach((u) => u());
  }, [tripCode]);

  // Trip date calculations
  const tripStart = config ? new Date(config.startDate) : new Date('2026-03-24');
  const tripEnd = config ? new Date(config.endDate) : new Date('2026-04-04');
  const now = new Date();
  const msPerDay = 86400000;

  const daysUntilTrip = Math.max(
    0,
    Math.ceil((tripStart.getTime() - now.getTime()) / msPerDay)
  );
  const tripStarted = now >= tripStart;
  const tripEnded = now > tripEnd;
  const todayDayIndex = tripStarted && !tripEnded
    ? Math.floor((now.getTime() - tripStart.getTime()) / msPerDay)
    : -1;

  return (
    <TripContext.Provider
      value={{
        tripCode,
        config,
        currentMember,
        days,
        flights,
        hotels,
        driving,
        rentalCars,
        highlights,
        restaurants,
        packingItems,
        photos,
        quizAnswers,
        loading,
        error,
        setTripCode: handleSetTripCode,
        setCurrentMember,
        todayDayIndex,
        daysUntilTrip,
        tripStarted,
        tripEnded,
      }}
    >
      {children}
    </TripContext.Provider>
  );
}
