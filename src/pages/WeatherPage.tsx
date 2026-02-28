import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud, Snowflake, Thermometer, Droplets, Mountain, RefreshCw, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTripContext } from '../context/TripContext';
import type { Hotel } from '../types/trip';

// Kaimaktsalan ski resort (Vigla-Pisoderi) — hardcoded as specifically requested
const KAIMAKTSALAN = {
  lat: 40.864,
  lon: 21.863,
  name: 'Kaimaktsalan Ski Resort',
  elevation: '~2,000 m',
  city: 'Kaimaktsalan',
};

// Fallback city coordinates for Northern Greece (used when hotel has no lat/lng)
const CITY_COORDS: Record<string, [number, number]> = {
  thessaloniki: [40.6401, 22.9444],
  'palios agios athanasios': [40.617, 23.034],
  'agios athanasios': [40.617, 23.034],
  'palios agios': [40.617, 23.034],
  edessa: [40.8003, 22.0455],
  kaimaktsalan: [40.864, 21.863],
  vergina: [40.4836, 22.3222],
  pella: [40.7635, 22.5239],
  halkidiki: [40.35, 23.5],
  'nea moudania': [40.2439, 23.2803],
  sithonia: [40.1667, 23.8167],
  kassandra: [40.0167, 23.3667],
  kavala: [40.9389, 24.4014],
  drama: [41.1499, 24.1439],
  kastoria: [40.5188, 21.2682],
  athens: [37.9838, 23.7275],
  meteora: [39.7217, 21.6306],
  kalambaka: [39.7056, 21.6261],
};

function resolveCityCoords(city: string): [number, number] | null {
  const key = city.toLowerCase().trim();
  for (const [name, coords] of Object.entries(CITY_COORDS)) {
    if (key.includes(name) || name.includes(key)) return coords;
  }
  return null;
}

// WMO weather codes → display info
function weatherInfo(code: number): { emoji: string; label: string; isSnow: boolean } {
  if (code === 0) return { emoji: '☀️', label: 'Clear sky', isSnow: false };
  if (code <= 3) return { emoji: '⛅', label: 'Partly cloudy', isSnow: false };
  if (code <= 48) return { emoji: '🌫️', label: 'Foggy', isSnow: false };
  if (code <= 57) return { emoji: '🌦️', label: 'Drizzle', isSnow: false };
  if (code <= 67) return { emoji: '🌧️', label: 'Rain', isSnow: false };
  if (code <= 77) return { emoji: '❄️', label: 'Snow', isSnow: true };
  if (code <= 82) return { emoji: '🌦️', label: 'Rain showers', isSnow: false };
  if (code <= 86) return { emoji: '🌨️', label: 'Snow showers', isSnow: true };
  return { emoji: '⛈️', label: 'Thunderstorm', isSnow: false };
}

interface DayForecast {
  date: string;       // display date (2026-xx-xx)
  maxTemp: number;
  minTemp: number;
  precipitation: number;
  snowfall: number;   // cm
  weatherCode: number;
}

// Fetch from Open-Meteo historical archive using same period in 2025
async function fetchHistoricalWeather(
  lat: number,
  lon: number,
  startDate: string,   // YYYY-MM-DD (2026)
  endDate: string,     // YYYY-MM-DD (2026)
): Promise<DayForecast[]> {
  const start2025 = startDate.replace('2026', '2025');
  const end2025 = endDate.replace('2026', '2025');

  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    start_date: start2025,
    end_date: end2025,
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,weather_code',
    timezone: 'Europe/Athens',
  });

  const resp = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`);
  if (!resp.ok) throw new Error(`Weather API ${resp.status}`);
  const data = await resp.json();

  return (data.daily.time as string[]).map((d2025, i) => ({
    date: d2025.replace('2025', '2026'),
    maxTemp: Math.round(data.daily.temperature_2m_max[i] ?? 0),
    minTemp: Math.round(data.daily.temperature_2m_min[i] ?? 0),
    precipitation: Math.round((data.daily.precipitation_sum[i] ?? 0) * 10) / 10,
    snowfall: Math.round((data.daily.snowfall_sum[i] ?? 0) * 10) / 10,
    weatherCode: data.daily.weather_code[i] ?? 0,
  }));
}

// Derive stay date range from hotel check-in / check-out
function stayDates(hotel: Hotel): { start: string; end: string } {
  const checkInDate = hotel.checkIn ? hotel.checkIn.slice(0, 10) : '';
  const checkOutDate = hotel.checkOut ? hotel.checkOut.slice(0, 10) : '';
  return { start: checkInDate, end: checkOutDate };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DayRow({ day, isHighMountain }: { day: DayForecast; isHighMountain: boolean }) {
  const info = weatherInfo(day.weatherCode);
  let displayDate = day.date;
  try {
    displayDate = format(parseISO(day.date), 'EEE, MMM d');
  } catch { /* ignore */ }

  return (
    <div className="weather-day-row">
      <span className="weather-day-label">{displayDate}</span>
      <span className="weather-emoji" title={info.label}>{info.emoji}</span>
      <span className="weather-label-text">{info.label}</span>
      <span className="weather-temps">
        <span className="temp-high">{day.maxTemp}°</span>
        <span className="temp-sep">/</span>
        <span className="temp-low">{day.minTemp}°</span>
      </span>
      {day.snowfall > 0 && (
        <span className="weather-snow-badge">❄️ {day.snowfall} cm</span>
      )}
      {day.precipitation > 0 && day.snowfall === 0 && (
        <span className="weather-rain-badge">💧 {day.precipitation} mm</span>
      )}
      {isHighMountain && day.snowfall === 0 && day.maxTemp > 2 && (
        <span className="weather-ski-note">Possible spring crust</span>
      )}
    </div>
  );
}

interface HotelWeatherCardProps {
  hotel: Hotel;
  index: number;
}

function HotelWeatherCard({ hotel, index }: HotelWeatherCardProps) {
  const [forecasts, setForecasts] = useState<DayForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isKaimaktsalan =
    hotel.city.toLowerCase().includes('kaimaktsalan') ||
    hotel.name.toLowerCase().includes('kaimaktsalan');

  const { lat, lng } = hotel;
  const fallbackCoords = resolveCityCoords(hotel.city);
  const resolvedLat = lat ?? fallbackCoords?.[0];
  const resolvedLon = lng ?? fallbackCoords?.[1];

  const { start, end } = stayDates(hotel);

  useEffect(() => {
    if (!resolvedLat || !resolvedLon || !start || !end) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchHistoricalWeather(resolvedLat, resolvedLon, start, end)
      .then((data) => setForecasts(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [resolvedLat, resolvedLon, start, end]);

  const hasCoords = !!resolvedLat && !!resolvedLon;

  let checkInStr = start;
  let checkOutStr = end;
  try { checkInStr = format(parseISO(hotel.checkIn), 'MMM d'); } catch { /* */ }
  try { checkOutStr = format(parseISO(hotel.checkOut), 'MMM d'); } catch { /* */ }

  return (
    <div className={`weather-card card ${isKaimaktsalan ? 'weather-card-snow' : ''}`}>
      <div className="weather-card-header">
        <div className="weather-card-icon">{isKaimaktsalan ? '🏔️' : '🏨'}</div>
        <div>
          <div className="weather-card-name">{hotel.name || `Hotel ${index + 1}`}</div>
          <div className="weather-card-city">
            {hotel.city}
            {isKaimaktsalan && (
              <span className="weather-ski-badge"> · Ski Resort ~2,000m</span>
            )}
          </div>
          <div className="weather-card-dates">{checkInStr} – {checkOutStr}</div>
        </div>
      </div>

      {!hasCoords && (
        <div className="weather-no-coords">
          <AlertCircle size={14} />
          <span>No coordinates set — add lat/lng in hotel settings to see forecast</span>
        </div>
      )}

      {hasCoords && loading && (
        <div className="weather-loading">
          <RefreshCw size={14} className="spin" /> Loading forecast…
        </div>
      )}

      {hasCoords && error && (
        <div className="weather-error">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {hasCoords && !loading && !error && forecasts.length > 0 && (
        <div className="weather-days">
          {forecasts.map((day) => (
            <DayRow key={day.date} day={day} isHighMountain={isKaimaktsalan} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Kaimaktsalan dedicated snow card ────────────────────────────────────────

function KaimaktsalanCard() {
  const [forecasts, setForecasts] = useState<DayForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { config } = useTripContext();

  const startDate = config?.startDate ?? '2026-03-24';
  const endDate = config?.endDate ?? '2026-04-04';

  useEffect(() => {
    setLoading(true);
    fetchHistoricalWeather(KAIMAKTSALAN.lat, KAIMAKTSALAN.lon, startDate, endDate)
      .then((data) => setForecasts(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  return (
    <div className="weather-card card weather-card-snow weather-kaimaktsalan">
      <div className="kaimaktsalan-header">
        <div className="kaimaktsalan-icon">🏔️</div>
        <div>
          <div className="kaimaktsalan-title">Kaimaktsalan Ski Resort</div>
          <div className="kaimaktsalan-subtitle">Snow Forecast · Elevation {KAIMAKTSALAN.elevation}</div>
        </div>
        <Snowflake size={28} className="kaimaktsalan-snowflake" />
      </div>

      <div className="kaimaktsalan-facts">
        <div className="kaimaktsalan-fact">
          <Mountain size={14} />
          <span>Vigla – Pisoderi resort, open late season</span>
        </div>
        <div className="kaimaktsalan-fact">
          <Thermometer size={14} />
          <span>Expect −5°C to +3°C at altitude</span>
        </div>
        <div className="kaimaktsalan-fact">
          <Snowflake size={14} />
          <span>Typical snowpack late March: 50–200 cm</span>
        </div>
        <div className="kaimaktsalan-fact">
          <Droplets size={14} />
          <span>Sun-crust mornings, soft snow afternoons</span>
        </div>
      </div>

      <div className="kaimaktsalan-divider" />

      <div className="kaimaktsalan-forecast-label">
        <Cloud size={13} /> Historical snow forecast (based on 2025 data)
      </div>

      {loading && (
        <div className="weather-loading">
          <RefreshCw size={14} className="spin" /> Loading snow forecast…
        </div>
      )}
      {error && (
        <div className="weather-error">
          <AlertCircle size={14} /> {error}
        </div>
      )}
      {!loading && !error && forecasts.length > 0 && (
        <div className="weather-days">
          {forecasts.map((day) => (
            <DayRow key={day.date} day={day} isHighMountain />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const WeatherPage: React.FC = () => {
  const { t } = useTranslation();
  const { hotels, config } = useTripContext();

  const sortedHotels = useMemo(
    () => [...hotels].sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime()),
    [hotels],
  );

  const tripLabel = config
    ? `${format(parseISO(config.startDate), 'MMM d')} – ${format(parseISO(config.endDate), 'MMM d, yyyy')}`
    : 'Mar 24 – Apr 4, 2026';

  return (
    <div className="weather-page">
      <h1 className="page-title">{t('weather.title')}</h1>
      <p className="weather-trip-label">
        <Cloud size={14} /> {tripLabel} · Based on 2025 historical data
      </p>

      {/* Always show the dedicated Kaimaktsalan snow card */}
      <div className="weather-section-label">
        <Snowflake size={15} /> {t('weather.snowForecast')}
      </div>
      <KaimaktsalanCard />

      {/* Hotel forecasts */}
      {sortedHotels.length > 0 && (
        <>
          <div className="weather-section-label" style={{ marginTop: 20 }}>
            🏨 {t('weather.hotelForecasts')}
          </div>
          {sortedHotels.map((hotel, idx) => (
            <HotelWeatherCard key={hotel.id} hotel={hotel} index={idx} />
          ))}
        </>
      )}

      {sortedHotels.length === 0 && (
        <div className="weather-no-hotels">
          No hotels added yet. Add hotels to see location forecasts.
        </div>
      )}
    </div>
  );
};

export default WeatherPage;
