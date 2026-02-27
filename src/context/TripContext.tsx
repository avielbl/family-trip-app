import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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
  TravelLogEntry,
} from '../types/trip';
import type { PassportStamp, EarnedStamp } from '../types/ai';
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
  subscribeTravelLog,
  subscribePassportStamps,
  subscribeEarnedStamps,
  getTripConfig,
  joinTrip,
} from '../firebase/tripService';
import { useAuthContext } from './AuthContext';

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
  travelLog: TravelLogEntry[];
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  passportStamps: PassportStamp[];
  earnedStamps: EarnedStamp[];
  setTripCode: (code: string) => Promise<boolean>;
  setCurrentMember: (member: FamilyMember) => void;
  todayDayIndex: number;
  daysUntilTrip: number;
  tripStarted: boolean;
  tripEnded: boolean;
  hotelChangeBanner: boolean;
  dismissHotelBanner: () => void;
}

const TripContext = createContext<TripContextType | null>(null);

export function useTripContext() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTripContext must be used within TripProvider');
  return ctx;
}

export function TripProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser, isAdmin, virtualMember } = useAuthContext();

  const [tripCode, setTripCodeState] = useState<string | null>(
    localStorage.getItem('tripCode')
  );
  const [config, setConfig] = useState<TripConfig | null>(null);
  const [currentMemberState, setCurrentMemberState] = useState<FamilyMember | null>(null);
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
  const [travelLog, setTravelLog] = useState<TravelLogEntry[]>([]);
  const [passportStamps, setPassportStamps] = useState<PassportStamp[]>([]);
  const [earnedStamps, setEarnedStamps] = useState<EarnedStamp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hotelChangeBanner, setHotelChangeBanner] = useState(false);
  const prevHotelsRef = useRef<Hotel[] | null>(null);
  const isFirstHotelLoad = useRef(true);

  // Restore member from localStorage (for non-Google users)
  useEffect(() => {
    const saved = localStorage.getItem('currentMember');
    if (saved) {
      try {
        setCurrentMemberState(JSON.parse(saved));
      } catch {}
    }
  }, []);

  // When config loads, match firebaseUser email to a family member
  useEffect(() => {
    if (!config) return;
    if (firebaseUser?.email) {
      const matched = config.familyMembers.find((m) => m.email === firebaseUser.email);
      if (matched) {
        setCurrentMemberState(matched);
        localStorage.setItem('currentMember', JSON.stringify(matched));
        return;
      }
    }
    // Fall back to virtual member (tablet) or saved member
    if (virtualMember) {
      setCurrentMemberState(virtualMember);
    }
  }, [config, firebaseUser, virtualMember]);

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
    unsubs.push(subscribeTravelLog(tripCode, setTravelLog));
    unsubs.push(subscribePassportStamps(tripCode, setPassportStamps));
    unsubs.push(subscribeEarnedStamps(tripCode, setEarnedStamps));

    return () => unsubs.forEach((u) => u());
  }, [tripCode]);

  // Hotel change detection (admin only)
  useEffect(() => {
    if (!isAdmin) {
      prevHotelsRef.current = hotels;
      return;
    }
    if (isFirstHotelLoad.current) {
      prevHotelsRef.current = hotels;
      isFirstHotelLoad.current = false;
      return;
    }
    const prev = prevHotelsRef.current;
    if (prev !== null) {
      const changed =
        prev.length !== hotels.length ||
        hotels.some((h) => {
          const old = prev.find((p) => p.id === h.id);
          return !old || old.city !== h.city || old.checkIn !== h.checkIn || old.checkOut !== h.checkOut;
        }) ||
        prev.some((p) => !hotels.find((h) => h.id === p.id));
      if (changed) {
        setHotelChangeBanner(true);
      }
    }
    prevHotelsRef.current = hotels;
  }, [hotels, isAdmin]);

  // Determine currentMember (Google-matched or manually selected)
  const currentMember = currentMemberState;

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
        travelLog,
        passportStamps,
        earnedStamps,
        loading,
        error,
        isAdmin,
        setTripCode: handleSetTripCode,
        setCurrentMember,
        todayDayIndex,
        daysUntilTrip,
        tripStarted,
        tripEnded,
        hotelChangeBanner,
        dismissHotelBanner: () => setHotelChangeBanner(false),
      }}
    >
      {children}
    </TripContext.Provider>
  );
}
