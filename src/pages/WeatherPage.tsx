import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud, Sun, CloudRain, CloudSnow, Wind, Droplets, Thermometer, Mountain } from 'lucide-react';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { useTripContext } from '../context/TripContext';
import type { Hotel } from '../types/trip';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DailyWeather {
  time: string;
  weathercode: number;
  temperature_2m_max: number;
  temperature_2m_min: number;
  precipitation_sum: number;
  snowfall_sum: number;
  windspeed_10m_max: number;
}

interface LocationForecast {
  location: string;
  lat: number;
  lng: number;
  days: DailyWeather[];
  error?: string;
}

interface SkiForecast {
  resort: string;
  lat: number;
  lng: number;
  days: DailyWeather[];
  error?: string;
}

// ─── Greek city coordinates fallback ─────────────────────────────────────────

const GREEK_CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'athens': { lat: 37.9838, lng: 23.7275 },
  'athina': { lat: 37.9838, lng: 23.7275 },
  'thessaloniki': { lat: 40.6401, lng: 22.9444 },
  'santorini': { lat: 36.3932, lng: 25.4615 },
  'thira': { lat: 36.3932, lng: 25.4615 },
  'mykonos': { lat: 37.4467, lng: 25.3289 },
  'heraklion': { lat: 35.3387, lng: 25.1442 },
  'crete': { lat: 35.2401, lng: 24.8093 },
  'rhodes': { lat: 36.4341, lng: 28.2176 },
  'corfu': { lat: 39.6243, lng: 19.9217 },
  'nafplio': { lat: 37.5678, lng: 22.8011 },
  'delphi': { lat: 38.4825, lng: 22.5009 },
  'meteora': { lat: 39.7217, lng: 21.6306 },
  'olympia': { lat: 37.6383, lng: 21.6300 },
  'arachova': { lat: 38.4784, lng: 22.5895 },
  'kalambaka': { lat: 39.7050, lng: 21.6289 },
  'patras': { lat: 38.2466, lng: 21.7346 },
  'volos': { lat: 39.3667, lng: 22.9333 },
  'zakynthos': { lat: 37.7943, lng: 20.8956 },
  'ios': { lat: 36.7218, lng: 25.2865 },
  'paros': { lat: 37.0853, lng: 25.1500 },
  'naxos': { lat: 37.1036, lng: 25.3764 },
};

// ─── Greek Ski Resorts ────────────────────────────────────────────────────────

const GREEK_SKI_RESORTS = [
  { name: 'Parnassos Ski Center', nameHe: 'מרכז סקי פרנסוס', lat: 38.5247, lng: 22.6267, nearCity: 'Arachova/Delphi' },
  { name: 'Vasilitsa Ski Resort', nameHe: 'אתר סקי וסיליצה', lat: 40.0183, lng: 21.3417, nearCity: 'Grevena' },
  { name: 'Seli Ski Resort', nameHe: 'אתר סקי סלי', lat: 40.2167, lng: 22.1833, nearCity: 'Veroia' },
  { name: 'Falakro Ski Resort', nameHe: 'אתר סקי פלקרו', lat: 41.2700, lng: 24.0700, nearCity: 'Drama' },
  { name: '3-5 Pigadia Ski Resort', nameHe: 'אתר סקי 3-5 פיגדיה', lat: 40.3167, lng: 21.9000, nearCity: 'Naoussa' },
];

// Distance between two lat/lng in km (Haversine)
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Find ski resorts within 120km of any hotel
function findNearbySkiResorts(hotels: Hotel[]) {
  const nearby: typeof GREEK_SKI_RESORTS = [];
  for (const resort of GREEK_SKI_RESORTS) {
    for (const hotel of hotels) {
      const lat = hotel.lat ?? getCityCoords(hotel.city)?.lat;
      const lng = hotel.lng ?? getCityCoords(hotel.city)?.lng;
      if (!lat || !lng) continue;
      if (distanceKm(lat, lng, resort.lat, resort.lng) < 120) {
        if (!nearby.find((r) => r.name === resort.name)) {
          nearby.push(resort);
        }
        break;
      }
    }
  }
  // Always show Parnassos (most relevant for Athens-area Greece trips)
  if (!nearby.find((r) => r.name === 'Parnassos Ski Center')) {
    nearby.push(GREEK_SKI_RESORTS[0]);
  }
  return nearby;
}

function getCityCoords(city: string): { lat: number; lng: number } | null {
  const key = city.toLowerCase().trim();
  for (const [name, coords] of Object.entries(GREEK_CITY_COORDS)) {
    if (key.includes(name) || name.includes(key)) return coords;
  }
  return null;
}

// ─── WMO Weather Code helpers ─────────────────────────────────────────────────

function getWeatherLabel(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 49) return 'Fog';
  if (code <= 59) return 'Drizzle';
  if (code <= 69) return 'Rain';
  if (code <= 79) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

function WeatherIcon({ code, size = 20 }: { code: number; size?: number }) {
  if (code === 0) return <Sun size={size} color="#f59e0b" />;
  if (code <= 2) return <Cloud size={size} color="#94a3b8" />;
  if (code === 3) return <Cloud size={size} color="#64748b" />;
  if (code <= 59) return <CloudRain size={size} color="#60a5fa" />;
  if (code <= 79) return <CloudSnow size={size} color="#93c5fd" />;
  if (code <= 82) return <CloudRain size={size} color="#3b82f6" />;
  if (code <= 86) return <CloudSnow size={size} color="#a5b4fc" />;
  return <CloudRain size={size} color="#818cf8" />;
}

// ─── Fetch weather ────────────────────────────────────────────────────────────

async function fetchWeather(lat: number, lng: number): Promise<DailyWeather[]> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lng));
  url.searchParams.set(
    'daily',
    'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,windspeed_10m_max'
  );
  url.searchParams.set('timezone', 'Europe/Athens');
  url.searchParams.set('forecast_days', '14');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  return (data.daily.time as string[]).map((time: string, i: number) => ({
    time,
    weathercode: data.daily.weathercode[i],
    temperature_2m_max: data.daily.temperature_2m_max[i],
    temperature_2m_min: data.daily.temperature_2m_min[i],
    precipitation_sum: data.daily.precipitation_sum[i],
    snowfall_sum: data.daily.snowfall_sum[i],
    windspeed_10m_max: data.daily.windspeed_10m_max[i],
  }));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeatherPage() {
  const { t, i18n } = useTranslation();
  const { hotels, config } = useTripContext();
  const isRTL = i18n.language === 'he';

  const [forecasts, setForecasts] = useState<LocationForecast[]>([]);
  const [skiForecast, setSkiForecast] = useState<SkiForecast | null>(null);
  const [loading, setLoading] = useState(true);

  const tripStart = config ? parseISO(config.startDate) : parseISO('2026-03-24');
  const tripEnd = config ? parseISO(config.endDate) : parseISO('2026-04-04');

  // Unique hotel locations (deduplicated by city)
  const hotelLocations = useMemo(() => {
    const seen = new Set<string>();
    return hotels
      .map((h) => {
        const lat = h.lat ?? getCityCoords(h.city)?.lat;
        const lng = h.lng ?? getCityCoords(h.city)?.lng;
        if (!lat || !lng) return null;
        const key = h.city.toLowerCase();
        if (seen.has(key)) return null;
        seen.add(key);
        return { location: h.city || h.name, lat, lng, hotel: h };
      })
      .filter(Boolean) as { location: string; lat: number; lng: number; hotel: Hotel }[];
  }, [hotels]);

  // If no hotels loaded yet (Firebase not connected), use Athens as default
  const locationsToFetch = useMemo(() => {
    if (hotelLocations.length > 0) return hotelLocations;
    return [{ location: 'Athens', lat: 37.9838, lng: 23.7275, hotel: null as unknown as Hotel }];
  }, [hotelLocations]);

  // Find nearby ski resorts
  const nearbySkiResorts = useMemo(() => findNearbySkiResorts(hotels), [hotels]);

  useEffect(() => {
    setLoading(true);
    const fetchAll = async () => {
      // Fetch all location forecasts in parallel
      const locationResults = await Promise.all(
        locationsToFetch.map(async (loc) => {
          try {
            const days = await fetchWeather(loc.lat, loc.lng);
            return { location: loc.location, lat: loc.lat, lng: loc.lng, days };
          } catch (e) {
            return { location: loc.location, lat: loc.lat, lng: loc.lng, days: [], error: String(e) };
          }
        })
      );
      setForecasts(locationResults);

      // Fetch ski resort forecast (Parnassos as primary)
      const skiResort = nearbySkiResorts[0];
      if (skiResort) {
        try {
          const days = await fetchWeather(skiResort.lat, skiResort.lng);
          setSkiForecast({ resort: isRTL ? skiResort.nameHe : skiResort.name, lat: skiResort.lat, lng: skiResort.lng, days });
        } catch (e) {
          setSkiForecast({ resort: skiResort.name, lat: skiResort.lat, lng: skiResort.lng, days: [], error: String(e) });
        }
      }

      setLoading(false);
    };
    fetchAll();
  }, [locationsToFetch, nearbySkiResorts, isRTL]);

  // Filter days within trip window (or nearby)
  function filterTripDays(days: DailyWeather[]): DailyWeather[] {
    return days.filter((d) => {
      const date = parseISO(d.time);
      return isWithinInterval(date, { start: tripStart, end: tripEnd });
    });
  }

  const formatDay = (isoDate: string) => {
    try {
      return format(parseISO(isoDate), 'EEE, MMM d');
    } catch {
      return isoDate;
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <Sun size={40} className="spin" />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="weather-page">
      <h1 className="page-title">
        {isRTL ? 'תחזית מזג האוויר' : 'Weather Forecast'}
      </h1>
      <p className="page-subtitle">
        {isRTL
          ? `תחזית לתאריכי הטיול: ${format(tripStart, 'dd/MM')} – ${format(tripEnd, 'dd/MM/yyyy')}`
          : `Trip dates: ${format(tripStart, 'MMM d')} – ${format(tripEnd, 'MMM d, yyyy')}`}
      </p>

      {/* ─── Location Forecasts ─────────────────────────────── */}
      {forecasts.map((fc) => {
        const tripDays = filterTripDays(fc.days);
        const allDays = fc.days.length > 0 ? (tripDays.length > 0 ? tripDays : fc.days.slice(0, 7)) : [];

        return (
          <section key={fc.location} className="weather-section">
            <div className="weather-section-header">
              <Sun size={18} />
              <h2>{fc.location}</h2>
            </div>

            {fc.error ? (
              <p className="weather-error">
                {isRTL ? 'לא ניתן לטעון תחזית' : 'Unable to load forecast'}
              </p>
            ) : allDays.length === 0 ? (
              <p className="weather-error">
                {isRTL ? 'אין נתוני תחזית' : 'No forecast data available'}
              </p>
            ) : (
              <div className="weather-days-grid">
                {allDays.map((day) => (
                  <WeatherDayCard key={day.time} day={day} formatDay={formatDay} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* ─── Ski / Snow Forecast ─────────────────────────────── */}
      {skiForecast && (
        <section className="weather-section ski-section">
          <div className="weather-section-header ski-header">
            <Mountain size={18} />
            <h2>
              {isRTL ? `תחזית שלג – ${skiForecast.resort}` : `Snow Forecast – ${skiForecast.resort}`}
            </h2>
          </div>
          <p className="ski-note">
            {isRTL
              ? 'הר פרנסוס הוא אתר הסקי הפופולרי ביותר ליד אזור אתונה ודלפי. תחזית שלג לתאריכי הטיול:'
              : 'Mt. Parnassos hosts Greece\'s most popular ski resort near Athens & Delphi. Snow forecast for trip dates:'}
          </p>

          {skiForecast.error ? (
            <p className="weather-error">
              {isRTL ? 'לא ניתן לטעון תחזית שלג' : 'Unable to load snow forecast'}
            </p>
          ) : (
            <div className="weather-days-grid">
              {(filterTripDays(skiForecast.days).length > 0
                ? filterTripDays(skiForecast.days)
                : skiForecast.days.slice(0, 7)
              ).map((day) => (
                <SkiDayCard key={day.time} day={day} formatDay={formatDay} isRTL={isRTL} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WeatherDayCard({
  day,
  formatDay,
}: {
  day: DailyWeather;
  formatDay: (d: string) => string;
}) {
  return (
    <div className="weather-day-card">
      <div className="weather-day-date">{formatDay(day.time)}</div>
      <div className="weather-day-icon">
        <WeatherIcon code={day.weathercode} size={28} />
      </div>
      <div className="weather-day-label">{getWeatherLabel(day.weathercode)}</div>
      <div className="weather-day-temps">
        <span className="temp-max">
          <Thermometer size={12} />
          {Math.round(day.temperature_2m_max)}°
        </span>
        <span className="temp-min">{Math.round(day.temperature_2m_min)}°</span>
      </div>
      {day.precipitation_sum > 0 && (
        <div className="weather-day-precip">
          <Droplets size={12} />
          <span>{day.precipitation_sum.toFixed(1)} mm</span>
        </div>
      )}
      {day.windspeed_10m_max > 20 && (
        <div className="weather-day-wind">
          <Wind size={12} />
          <span>{Math.round(day.windspeed_10m_max)} km/h</span>
        </div>
      )}
    </div>
  );
}

function SkiDayCard({
  day,
  formatDay,
  isRTL,
}: {
  day: DailyWeather;
  formatDay: (d: string) => string;
  isRTL: boolean;
}) {
  const hasSnow = day.snowfall_sum > 0;
  return (
    <div className={`weather-day-card ski-day-card ${hasSnow ? 'ski-snow-day' : ''}`}>
      <div className="weather-day-date">{formatDay(day.time)}</div>
      <div className="weather-day-icon">
        {hasSnow ? <CloudSnow size={28} color="#60a5fa" /> : <WeatherIcon code={day.weathercode} size={28} />}
      </div>
      <div className="weather-day-temps">
        <span className="temp-max">
          <Thermometer size={12} />
          {Math.round(day.temperature_2m_max)}°
        </span>
        <span className="temp-min">{Math.round(day.temperature_2m_min)}°</span>
      </div>
      <div className={`ski-snow-amount ${hasSnow ? 'has-snow' : 'no-snow'}`}>
        <CloudSnow size={12} />
        <span>
          {hasSnow
            ? `${day.snowfall_sum.toFixed(1)} cm ${isRTL ? 'שלג' : 'snow'}`
            : isRTL ? 'אין שלג' : 'No snow'}
        </span>
      </div>
      {day.precipitation_sum > 0 && (
        <div className="weather-day-precip">
          <Droplets size={12} />
          <span>{day.precipitation_sum.toFixed(1)} mm</span>
        </div>
      )}
    </div>
  );
}
