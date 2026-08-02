import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud, Sun, CloudRain, CloudSnow, Wind, Droplets, Thermometer, Mountain } from 'lucide-react';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { useTripContext } from '../context/TripContext';
import { geocode as geocodeCity } from '../utils/geocode';

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

// ─── City coordinate resolution ──────────────────────────────────────────────
// Shared geocoder (seed table → cache → Open-Meteo API) — src/utils/geocode.

// ─── Ski Resorts (shown only when the trip is actually nearby) ───────────────

const SKI_RESORTS = [
  { name: 'Kaimaktsalan Ski Resort', nameHe: 'אתר סקי קיימקצלן', lat: 40.8395, lng: 21.7780, nearCity: 'Edessa/Aridaia' },
  { name: 'Seli Ski Resort', nameHe: 'אתר סקי סלי', lat: 40.2167, lng: 22.1833, nearCity: 'Veroia' },
  { name: 'Vasilitsa Ski Resort', nameHe: 'אתר סקי וסיליצה', lat: 40.0183, lng: 21.3417, nearCity: 'Grevena' },
  { name: '3-5 Pigadia Ski Resort', nameHe: 'אתר סקי 3-5 פיגדיה', lat: 40.3167, lng: 21.9000, nearCity: 'Naoussa' },
  { name: 'Falakro Ski Resort', nameHe: 'אתר סקי פלקרו', lat: 41.2700, lng: 24.0700, nearCity: 'Drama' },
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

// Find ski resorts within 120km of any resolved trip location. If the trip
// isn't near any listed resort, the ski section simply doesn't render.
function findNearbySkiResorts(locations: Array<{ lat: number; lng: number }>) {
  const nearby: typeof SKI_RESORTS = [];
  for (const resort of SKI_RESORTS) {
    for (const loc of locations) {
      if (distanceKm(loc.lat, loc.lng, resort.lat, resort.lng) < 120) {
        if (!nearby.find((r) => r.name === resort.name)) {
          nearby.push(resort);
        }
        break;
      }
    }
  }
  return nearby;
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
  url.searchParams.set('timezone', 'auto');
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

  // Extra locations added via AI chat (stored in localStorage)
  const [extraLocations] = useState<Array<{ city: string; lat?: number; lng?: number }>>(() => {
    try {
      return JSON.parse(localStorage.getItem('weatherExtraLocations') ?? '[]');
    } catch {
      return [];
    }
  });

  const tripStart = config ? parseISO(config.startDate) : null;
  const tripEnd = config ? parseISO(config.endDate) : null;

  // Cities the active trip actually visits: every hotel city (deduplicated),
  // plus chat-added extras; fall back to the trip's destination when the trip
  // has no hotels yet. Coordinates come from the hotel doc when present,
  // otherwise from geocoding.
  const wantedLocations = useMemo(() => {
    const seen = new Set<string>();
    const wanted: Array<{ label: string; city: string; lat?: number; lng?: number }> = [];
    for (const h of hotels) {
      const label = h.city || h.name;
      const key = label.toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      wanted.push({ label, city: label, lat: h.lat, lng: h.lng });
    }
    for (const e of extraLocations) {
      const key = e.city.toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      wanted.push({ label: e.city, city: e.city, lat: e.lat, lng: e.lng });
    }
    if (wanted.length === 0 && config?.destination) {
      wanted.push({ label: config.destination, city: config.destination });
    }
    return wanted;
  }, [hotels, extraLocations, config?.destination]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const fetchAll = async () => {
      // Resolve coordinates (hotel doc → seed table → geocoding API)
      const resolved = (
        await Promise.all(
          wantedLocations.map(async (loc) => {
            const coords =
              loc.lat && loc.lng
                ? { lat: loc.lat, lng: loc.lng }
                : await geocodeCity(loc.city);
            if (!coords) return null;
            return { location: loc.label, lat: coords.lat, lng: coords.lng };
          })
        )
      ).filter(Boolean) as Array<{ location: string; lat: number; lng: number }>;

      // Fetch all location forecasts in parallel
      const locationResults = await Promise.all(
        resolved.map(async (loc) => {
          try {
            const days = await fetchWeather(loc.lat, loc.lng);
            return { ...loc, days };
          } catch (e) {
            return { ...loc, days: [], error: String(e) };
          }
        })
      );
      if (cancelled) return;
      setForecasts(locationResults);

      // Ski forecast only when the trip is actually near a listed resort
      const skiResort = findNearbySkiResorts(resolved)[0];
      if (skiResort) {
        try {
          const days = await fetchWeather(skiResort.lat, skiResort.lng);
          if (!cancelled) setSkiForecast({ resort: isRTL ? skiResort.nameHe : skiResort.name, lat: skiResort.lat, lng: skiResort.lng, days });
        } catch (e) {
          if (!cancelled) setSkiForecast({ resort: skiResort.name, lat: skiResort.lat, lng: skiResort.lng, days: [], error: String(e) });
        }
      } else if (!cancelled) {
        setSkiForecast(null);
      }

      if (!cancelled) setLoading(false);
    };
    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [wantedLocations, isRTL]);

  // Filter days within trip window (or nearby)
  function filterTripDays(days: DailyWeather[]): DailyWeather[] {
    if (!tripStart || !tripEnd) return [];
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
      {tripStart && tripEnd && (
        <p className="page-subtitle">
          {isRTL
            ? `תחזית לתאריכי הטיול: ${format(tripStart, 'dd/MM')} – ${format(tripEnd, 'dd/MM/yyyy')}`
            : `Trip dates: ${format(tripStart, 'MMM d')} – ${format(tripEnd, 'MMM d, yyyy')}`}
        </p>
      )}

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
              ? `${skiForecast.resort} הוא אתר הסקי הקרוב ביותר לאזור הטיול. תחזית שלג:`
              : `${skiForecast.resort} is the ski resort closest to the trip. Snow forecast:`}
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
