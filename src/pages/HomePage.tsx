import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Plane,
  Hotel,
  MapPin,
  Sun,
  Waves,
  Camera,
  Star,
  ChevronRight,
  TreePalm,
  CheckCircle2,
  Clock,
  Calendar,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTripContext } from '../context/TripContext';
import type { Flight, Hotel as HotelType, Highlight } from '../types/trip';

const TOTAL_DAYS = 12;

/** Map highlight categories to icons */
const categoryIcons: Record<string, React.ReactNode> = {
  beach: <Waves size={18} />,
  ruins: <MapPin size={18} />,
  museum: <MapPin size={18} />,
  food: <Star size={18} />,
  'kids-fun': <Sun size={18} />,
  nature: <TreePalm size={18} />,
  shopping: <Star size={18} />,
  viewpoint: <Camera size={18} />,
  other: <MapPin size={18} />,
};

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const {
    days,
    flights,
    hotels,
    highlights,
    todayDayIndex,
    daysUntilTrip,
    tripStarted,
    tripEnded,
    config,
  } = useTripContext();

  const isRTL = i18n.language === 'he';

  // Current day number (1-based) and progress
  const currentDayNumber = todayDayIndex >= 0 ? todayDayIndex + 1 : 0;
  const progressPercent = tripStarted && !tripEnded
    ? Math.round((currentDayNumber / TOTAL_DAYS) * 100)
    : tripEnded
      ? 100
      : 0;

  // Today's data
  const todayDay = useMemo(
    () => days.find((d) => d.dayIndex === todayDayIndex),
    [days, todayDayIndex],
  );

  const todayFlights = useMemo(
    () => flights.filter((f) => f.dayIndex === todayDayIndex),
    [flights, todayDayIndex],
  );

  const currentHotel = useMemo(
    () =>
      hotels.find(
        (h) => todayDayIndex >= h.dayIndexStart && todayDayIndex <= h.dayIndexEnd,
      ),
    [hotels, todayDayIndex],
  );

  const todayHighlights = useMemo(
    () => highlights.filter((h) => h.dayIndex === todayDayIndex),
    [highlights, todayDayIndex],
  );

  // Upcoming flights (next flight from today onward)
  const upcomingFlights = useMemo(() => {
    if (tripEnded) return [];
    const idx = tripStarted ? todayDayIndex : 0;
    return flights
      .filter((f) => f.dayIndex >= idx)
      .sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime())
      .slice(0, 2);
  }, [flights, todayDayIndex, tripStarted, tripEnded]);

  // Stats for trip-ended summary
  const totalHighlightsCompleted = useMemo(
    () => highlights.filter((h) => h.completed).length,
    [highlights],
  );

  // ─── Before Trip: Countdown ─────────────────────────────────────────
  function renderCountdown() {
    return (
      <div className="home-page">
        {/* Hero Countdown */}
        <div className="countdown-card">
          <div className="countdown-icon">
            <Sun size={48} strokeWidth={1.5} />
          </div>
          <h1 className="countdown-number">{daysUntilTrip}</h1>
          <p className="countdown-label">
            {t('home.countdown', { days: daysUntilTrip })}
          </p>
          <div className="countdown-dates">
            <Calendar size={16} />
            <span>
              {config
                ? `${format(parseISO(config.startDate), 'MMM d')} - ${format(parseISO(config.endDate), 'MMM d, yyyy')}`
                : 'Mar 24 - Apr 4, 2026'}
            </span>
          </div>
        </div>

        {/* Upcoming Flights Preview */}
        {upcomingFlights.length > 0 && (
          <section className="home-section">
            <div className="section-title" onClick={() => navigate('/flights')}>
              <Plane size={20} />
              <span>{t('home.upcomingFlights')}</span>
              <ChevronRight size={18} className="section-chevron" />
            </div>
            {upcomingFlights.map((flight) => (
              <FlightCard key={flight.id} flight={flight} />
            ))}
          </section>
        )}
      </div>
    );
  }

  // ─── During Trip: Active Day ────────────────────────────────────────
  function renderActiveTrip() {
    return (
      <div className="home-page">
        {/* Day Hero */}
        <div className="day-card">
          <p className="day-greeting">{t('home.countdownToday')}</p>
          <h1 className="day-title">
            {t('home.dayOf', { day: currentDayNumber })}
          </h1>
          {todayDay && (
            <p className="day-location">
              <MapPin size={16} />
              <span>{isRTL && todayDay.locationHe ? todayDay.locationHe : todayDay.location}</span>
            </p>
          )}
          {todayDay && (
            <p className="day-subtitle">
              {isRTL ? todayDay.titleHe : todayDay.title}
            </p>
          )}

          {/* Progress Bar */}
          <div className="progress-container">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="progress-label">
              {t('home.progress', { percent: progressPercent })}
            </p>
          </div>
        </div>

        {/* Today's Flights */}
        {todayFlights.length > 0 && (
          <section className="home-section">
            <div className="section-title" onClick={() => navigate('/flights')}>
              <Plane size={20} />
              <span>{t('home.upcomingFlights')}</span>
              <ChevronRight size={18} className="section-chevron" />
            </div>
            {todayFlights.map((flight) => (
              <FlightCard key={flight.id} flight={flight} />
            ))}
          </section>
        )}

        {/* Current Hotel */}
        {currentHotel && (
          <section className="home-section">
            <div className="section-title" onClick={() => navigate('/hotels')}>
              <Hotel size={20} />
              <span>{t('home.currentHotel')}</span>
              <ChevronRight size={18} className="section-chevron" />
            </div>
            <HotelCard hotel={currentHotel} />
          </section>
        )}

        {/* Today's Highlights */}
        {todayHighlights.length > 0 && (
          <section className="home-section">
            <div className="section-title" onClick={() => navigate('/highlights')}>
              <Star size={20} />
              <span>{t('home.todayHighlights')}</span>
              <ChevronRight size={18} className="section-chevron" />
            </div>
            <div className="highlights-list">
              {todayHighlights.map((hl) => (
                <HighlightCard key={hl.id} highlight={hl} isRTL={isRTL} />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // ─── After Trip: Summary ────────────────────────────────────────────
  function renderTripEnded() {
    return (
      <div className="home-page">
        <div className="day-card summary-card">
          <div className="summary-icon">
            <CheckCircle2 size={48} strokeWidth={1.5} />
          </div>
          <h1 className="summary-title">{t('app.title')}</h1>
          <p className="summary-subtitle">{t('app.subtitle')}</p>

          <div className="progress-container">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: '100%' }} />
            </div>
            <p className="progress-label">
              {t('home.progress', { percent: 100 })}
            </p>
          </div>

          <div className="summary-stats">
            <div className="stat-item">
              <span className="stat-number">{TOTAL_DAYS}</span>
              <span className="stat-label">{t('common.day')}s</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{totalHighlightsCompleted}</span>
              <span className="stat-label">{t('nav.highlights')}</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{flights.length}</span>
              <span className="stat-label">{t('nav.flights')}</span>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <section className="home-section">
          <div
            className="section-title"
            onClick={() => navigate('/photos')}
            style={{ cursor: 'pointer' }}
          >
            <Camera size={20} />
            <span>{t('nav.photos')}</span>
            <ChevronRight size={18} className="section-chevron" />
          </div>
        </section>
      </div>
    );
  }

  // ─── Render Logic ───────────────────────────────────────────────────
  if (tripEnded) return renderTripEnded();
  if (tripStarted) return renderActiveTrip();
  return renderCountdown();
}

// ─── Sub-components ─────────────────────────────────────────────────────

function FlightCard({ flight }: { flight: Flight }) {
  let departureFormatted: string;
  let arrivalFormatted: string;
  try {
    departureFormatted = format(parseISO(flight.departureTime), 'MMM d, HH:mm');
    arrivalFormatted = format(parseISO(flight.arrivalTime), 'HH:mm');
  } catch {
    departureFormatted = flight.departureTime;
    arrivalFormatted = flight.arrivalTime;
  }

  return (
    <div className="flight-card">
      <div className="flight-card-header">
        <Plane size={16} />
        <span className="flight-number">
          {flight.airline} {flight.flightNumber}
        </span>
      </div>
      <div className="flight-card-route">
        <div className="flight-endpoint">
          <span className="airport-code">{flight.departureAirportCode}</span>
          <span className="airport-time">{departureFormatted}</span>
        </div>
        <div className="flight-arrow">
          <ChevronRight size={16} />
        </div>
        <div className="flight-endpoint">
          <span className="airport-code">{flight.arrivalAirportCode}</span>
          <span className="airport-time">{arrivalFormatted}</span>
        </div>
      </div>
      {flight.terminal && (
        <div className="flight-detail">
          <Clock size={14} />
          <span>Terminal {flight.terminal}{flight.gate ? ` / Gate ${flight.gate}` : ''}</span>
        </div>
      )}
    </div>
  );
}

function HotelCard({ hotel }: { hotel: HotelType }) {
  return (
    <div className="hotel-card">
      {hotel.imageUrl && (
        <div
          className="hotel-card-image"
          style={{
            backgroundImage: `url(${hotel.imageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            height: 120,
            borderRadius: '8px 8px 0 0',
          }}
        />
      )}
      <div className="hotel-card-body">
        <h3 className="hotel-card-name">
          <Hotel size={16} />
          <span>{hotel.name}</span>
        </h3>
        <p className="hotel-card-city">{hotel.city}</p>
        {hotel.wifiPassword && (
          <p className="hotel-card-wifi">
            WiFi: <strong>{hotel.wifiPassword}</strong>
          </p>
        )}
      </div>
    </div>
  );
}

function HighlightCard({
  highlight,
  isRTL,
}: {
  highlight: Highlight;
  isRTL: boolean;
}) {
  const name = isRTL && highlight.nameHe ? highlight.nameHe : highlight.name;
  const description =
    isRTL && highlight.descriptionHe
      ? highlight.descriptionHe
      : highlight.description;

  return (
    <div className={`highlight-card ${highlight.completed ? 'highlight-completed' : ''}`}>
      <div className="highlight-card-icon">
        {categoryIcons[highlight.category] || <MapPin size={18} />}
      </div>
      <div className="highlight-card-content">
        <h4 className="highlight-card-name">
          {name}
          {highlight.completed && (
            <CheckCircle2 size={14} className="highlight-check" />
          )}
        </h4>
        {description && (
          <p className="highlight-card-desc">{description}</p>
        )}
        {highlight.openingHours && (
          <span className="highlight-card-hours">
            <Clock size={12} /> {highlight.openingHours}
          </span>
        )}
      </div>
    </div>
  );
}
