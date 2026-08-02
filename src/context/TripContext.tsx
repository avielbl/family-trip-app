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
  QuizQuestion,
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
  subscribeQuizQuestions,
  subscribeTravelLog,
  subscribePassportStamps,
  subscribeEarnedStamps,
  getTripConfig,
  joinTrip,
  loadAIConfigFromServer,
} from '../firebase/tripService';
import { setAIConfig } from '../firebase/aiService';
import { useAuthContext, isBootstrapAdminEmail } from './AuthContext';
import { useFamilyContext } from './FamilyContext';

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
  quizQuestions: QuizQuestion[];
  travelLog: TravelLogEntry[];
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  passportStamps: PassportStamp[];
  earnedStamps: EarnedStamp[];
  setTripCode: (code: string) => Promise<boolean>;
  setCurrentMember: (member: FamilyMember) => void;
  browseTrip: (code: string) => void;
  returnToActiveTrip: () => void;
  isViewingActiveTrip: boolean;
  totalDays: number;
  todayDayIndex: number;
  daysUntilTrip: number;
  tripStarted: boolean;
  tripEnded: boolean;
  hotelChangeBanner: boolean;
  dismissHotelBanner: () => void;
}

const TripContext = createContext<TripContextType | null>(null);

// eslint-disable-next-line react-refresh/only-export-components -- idiomatic context hook export
export function useTripContext() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTripContext must be used within TripProvider');
  return ctx;
}

const OVERRIDE_KEY = 'tripCodeOverride';
const LEGACY_TRIP_KEY = 'tripCode';
const memberKeyFor = (tripCode: string) => `currentMember:${tripCode}`;

export function TripProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser, virtualMember } = useAuthContext();
  const { family, familyLoading, isFamilyAdmin } = useFamilyContext();

  // Device-local browse override and legacy bootstrap pointer.
  const [overrideCode, setOverrideCode] = useState<string | null>(
    () => localStorage.getItem(OVERRIDE_KEY)
  );
  const [legacyCode, setLegacyCode] = useState<string | null>(
    () => localStorage.getItem(LEGACY_TRIP_KEY)
  );

  // tripCode is derived: device override → family active trip → newest family
  // trip (a family with trips but no active pointer must never strand the
  // user on the setup screen) → legacy pointer.
  const newestFamilyTrip = family?.tripCodes?.length
    ? family.tripCodes[family.tripCodes.length - 1]
    : null;
  const tripCode = overrideCode ?? family?.activeTripCode ?? newestFamilyTrip ?? legacyCode ?? null;

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
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [travelLog, setTravelLog] = useState<TravelLogEntry[]>([]);
  const [passportStamps, setPassportStamps] = useState<PassportStamp[]>([]);
  const [earnedStamps, setEarnedStamps] = useState<EarnedStamp[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hotelChangeBanner, setHotelChangeBanner] = useState(false);
  const prevHotelsRef = useRef<Hotel[] | null>(null);
  const isFirstHotelLoad = useRef(true);

  // Join flow: validate the code, store the legacy bootstrap pointer, and
  // clear any device-local browse override.
  const handleSetTripCode = useCallback(async (code: string): Promise<boolean> => {
    try {
      const exists = await joinTrip(code);
      if (exists) {
        localStorage.setItem(LEGACY_TRIP_KEY, code);
        localStorage.removeItem(OVERRIDE_KEY);
        setLegacyCode(code);
        setOverrideCode(null);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to join trip:', err);
      return false;
    }
  }, []);

  // Device-local browsing of a non-active trip.
  const browseTrip = useCallback((code: string) => {
    localStorage.setItem(OVERRIDE_KEY, code);
    setOverrideCode(code);
  }, []);

  const returnToActiveTrip = useCallback(() => {
    localStorage.removeItem(OVERRIDE_KEY);
    setOverrideCode(null);
  }, []);

  const isViewingActiveTrip =
    !overrideCode || overrideCode === family?.activeTripCode;

  // Subscribe to all trip data once family resolution settled and a code exists.
  useEffect(() => {
    if (familyLoading) return;

    // Re-keying: drop the previous trip's data immediately.
    /* eslint-disable react-hooks/set-state-in-effect -- intentional reset before resubscribing to a new trip */
    setConfig(null);
    setDays([]);
    setFlights([]);
    setHotels([]);
    setDriving([]);
    setRentalCars([]);
    setHighlights([]);
    setRestaurants([]);
    setPackingItems([]);
    setPhotos([]);
    setQuizAnswers([]);
    setQuizQuestions([]);
    setTravelLog([]);
    setPassportStamps([]);
    setEarnedStamps([]);
    // Re-arm hotel-change detection for the (re)keyed trip.
    isFirstHotelLoad.current = true;
    prevHotelsRef.current = null;

    if (!tripCode) {
      setConfigLoading(false);
      return;
    }

    setConfigLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    const unsubs: (() => void)[] = [];

    getTripConfig(tripCode)
      .then((cfg) => {
        setConfig(cfg);
        setConfigLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setConfigLoading(false);
      });

    // Load AI config from server and sync to localStorage so all users can use AI features
    loadAIConfigFromServer(tripCode).then((serverConfig) => {
      if (serverConfig?.apiKey) {
        setAIConfig(serverConfig);
      }
    }).catch(() => {/* silently ignore — AI config is optional */});

    unsubs.push(subscribeTripDays(tripCode, setDays));
    unsubs.push(subscribeFlights(tripCode, setFlights));
    unsubs.push(
      subscribeHotels(tripCode, (h) => {
        // Mark that a real snapshot arrived before state lands, so change
        // detection baselines on delivered data instead of the initial [].
        isFirstHotelLoad.current = false;
        setHotels(h);
      })
    );
    unsubs.push(subscribeDriving(tripCode, setDriving));
    unsubs.push(subscribeRentalCars(tripCode, setRentalCars));
    unsubs.push(subscribeHighlights(tripCode, setHighlights));
    unsubs.push(subscribeRestaurants(tripCode, setRestaurants));
    unsubs.push(subscribePackingItems(tripCode, setPackingItems));
    unsubs.push(subscribePhotos(tripCode, setPhotos));
    unsubs.push(subscribeQuizAnswers(tripCode, setQuizAnswers));
    unsubs.push(subscribeQuizQuestions(tripCode, setQuizQuestions));
    unsubs.push(subscribeTravelLog(tripCode, setTravelLog));
    unsubs.push(subscribePassportStamps(tripCode, setPassportStamps));
    unsubs.push(subscribeEarnedStamps(tripCode, setEarnedStamps));

    return () => unsubs.forEach((u) => u());
  }, [tripCode, familyLoading]);

  // Resolve currentMember per trip (bug A9): email match → saved per-trip →
  // legacy global key (migrated forward) → virtual member — always validated
  // against the current trip's roster.
  /* eslint-disable react-hooks/set-state-in-effect -- member re-resolution against localStorage on trip change */
  useEffect(() => {
    if (!config || !tripCode) {
      setCurrentMemberState(null);
      return;
    }
    const roster = config.familyMembers ?? [];
    const findById = (id?: string | null) =>
      roster.find((m) => m.id === id) ?? null;
    const perTripKey = memberKeyFor(tripCode);

    // 1. Email-matched member (Google sign-in)
    if (firebaseUser?.email) {
      const matched = roster.find((m) => m.email === firebaseUser.email);
      if (matched) {
        setCurrentMemberState(matched);
        localStorage.setItem(perTripKey, JSON.stringify(matched));
        return;
      }
    }

    // 2. Saved per-trip member
    const savedRaw = localStorage.getItem(perTripKey);
    if (savedRaw) {
      try {
        const saved = JSON.parse(savedRaw) as FamilyMember;
        const valid = findById(saved.id);
        if (valid) {
          setCurrentMemberState(valid);
          return;
        }
      } catch {
        /* corrupted entry — fall through */
      }
    }

    // 3. Legacy global key — migrate to the per-trip key when valid
    const legacyRaw = localStorage.getItem('currentMember');
    if (legacyRaw) {
      try {
        const legacy = JSON.parse(legacyRaw) as FamilyMember;
        const valid = findById(legacy.id);
        if (valid) {
          localStorage.setItem(perTripKey, JSON.stringify(valid));
          setCurrentMemberState(valid);
          return;
        }
      } catch {
        /* corrupted entry — fall through */
      }
    }

    // 4. Virtual member from the shared-tablet picker
    if (virtualMember) {
      const valid = findById(virtualMember.id);
      if (valid) {
        setCurrentMemberState(valid);
        return;
      }
    }

    // Never keep a member that isn't in this trip's roster.
    setCurrentMemberState(null);
  }, [config, tripCode, firebaseUser, virtualMember]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setCurrentMember = useCallback(
    (member: FamilyMember) => {
      setCurrentMemberState(member);
      if (tripCode) {
        localStorage.setItem(memberKeyFor(tripCode), JSON.stringify(member));
      }
    },
    [tripCode]
  );

  // Admin: family admin, trip admin, or legacy bootstrap email.
  const isAdmin =
    isFamilyAdmin ||
    (!!config?.adminUid && config.adminUid === firebaseUser?.uid) ||
    isBootstrapAdminEmail(firebaseUser?.email);

  // Hotel change detection (admin only). The comparison baseline is the first
  // snapshot Firestore actually delivers — NOT the initial empty state — so
  // simply opening the app never looks like "hotels changed".
  useEffect(() => {
    if (isFirstHotelLoad.current) {
      // Still waiting for the first delivered snapshot for this trip.
      return;
    }
    if (!isAdmin) {
      prevHotelsRef.current = hotels;
      return;
    }
    if (prevHotelsRef.current === null) {
      prevHotelsRef.current = hotels;
      return;
    }
    const prev = prevHotelsRef.current;
    {
      const changed =
        prev.length !== hotels.length ||
        hotels.some((h) => {
          const old = prev.find((p) => p.id === h.id);
          return !old || old.city !== h.city || old.checkIn !== h.checkIn || old.checkOut !== h.checkOut;
        }) ||
        prev.some((p) => !hotels.find((h) => h.id === p.id));
      if (changed) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- banner reacts to external Firestore hotel changes
        setHotelChangeBanner(true);
      }
    }
    prevHotelsRef.current = hotels;
  }, [hotels, isAdmin]);

  const loading = familyLoading || configLoading;

  // Trip date calculations — nothing date-dependent without a config.
  const msPerDay = 86400000;
  const tripStart = config ? new Date(config.startDate) : null;
  const tripEnd = config ? new Date(config.endDate) : null;
  const now = new Date();

  const totalDays =
    tripStart && tripEnd
      ? Math.round((tripEnd.getTime() - tripStart.getTime()) / msPerDay) + 1
      : 0;
  const daysUntilTrip = tripStart
    ? Math.max(0, Math.ceil((tripStart.getTime() - now.getTime()) / msPerDay))
    : 0;
  const tripStarted = !!tripStart && now >= tripStart;
  const tripEnded = !!tripEnd && now > tripEnd;
  const todayDayIndex =
    tripStart && tripStarted && !tripEnded
      ? Math.floor((now.getTime() - tripStart.getTime()) / msPerDay)
      : -1;

  return (
    <TripContext.Provider
      value={{
        tripCode,
        config,
        currentMember: currentMemberState,
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
        quizQuestions,
        travelLog,
        passportStamps,
        earnedStamps,
        loading,
        error,
        isAdmin,
        setTripCode: handleSetTripCode,
        setCurrentMember,
        browseTrip,
        returnToActiveTrip,
        isViewingActiveTrip,
        totalDays,
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
