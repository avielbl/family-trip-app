// Shared place-name → coordinates resolution for any trip destination.
// Resolution order: trip-agnostic seed table (instant) → localStorage cache →
// free Open-Meteo geocoding API (cached). Used by the map, weather, and
// driving-route estimation so every feature follows the active trip.

export interface Coords {
  lat: number;
  lng: number;
}

// Pre-seeded cache for cities from past trips (kept for offline stability).
const SEED_CITY_COORDS: Record<string, Coords> = {
  athens: { lat: 37.9838, lng: 23.7275 },
  athina: { lat: 37.9838, lng: 23.7275 },
  thessaloniki: { lat: 40.6401, lng: 22.9444 },
  skg: { lat: 40.5196, lng: 22.972 },
  ioannina: { lat: 39.6675, lng: 20.8511 },
  metsovo: { lat: 39.7703, lng: 21.1824 },
  pertouli: { lat: 39.473, lng: 21.451 },
  'palaios agios athanasios': { lat: 40.881, lng: 22.146 },
  pozar: { lat: 40.967, lng: 22.043 },
  edessa: { lat: 40.8005, lng: 22.051 },
  santorini: { lat: 36.3932, lng: 25.4615 },
  mykonos: { lat: 37.4467, lng: 25.3289 },
  heraklion: { lat: 35.3387, lng: 25.1442 },
  crete: { lat: 35.2401, lng: 24.8093 },
  rhodes: { lat: 36.4341, lng: 28.2176 },
  corfu: { lat: 39.6243, lng: 19.9217 },
  nafplio: { lat: 37.5678, lng: 22.8011 },
  delphi: { lat: 38.4825, lng: 22.5009 },
  meteora: { lat: 39.7217, lng: 21.6306 },
  kalambaka: { lat: 39.705, lng: 21.6289 },
};

const GEOCODE_CACHE_KEY = 'geocodeCache.v1';

function readCache(): Record<string, Coords | null> {
  try {
    return JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, Coords | null>): void {
  try {
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* storage full — geocoding still works, just uncached */
  }
}

/** Synchronous best-effort lookup: seed table (partial match) or cache hit. */
export function cachedCoords(place: string): Coords | null {
  const key = place.toLowerCase().trim();
  if (!key) return null;
  for (const [name, coords] of Object.entries(SEED_CITY_COORDS)) {
    if (key.includes(name) || name.includes(key)) return coords;
  }
  const cached = readCache()[key];
  return cached ?? null;
}

/** Resolve a place name to coordinates, hitting the network at most once per name. */
export async function geocode(place: string): Promise<Coords | null> {
  const key = place.toLowerCase().trim();
  if (!key) return null;
  const instant = cachedCoords(place);
  if (instant) return instant;
  const cache = readCache();
  if (key in cache) return cache[key]; // includes cached "not found" (null)
  try {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.set('name', place);
    url.searchParams.set('count', '1');
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data.results?.[0];
    const coords: Coords | null = hit
      ? { lat: hit.latitude as number, lng: hit.longitude as number }
      : null;
    cache[key] = coords;
    writeCache(cache);
    return coords;
  } catch {
    return null;
  }
}

/** Resolve many names concurrently; returns a name → coords map (misses = null). */
export async function geocodeMany(
  places: string[]
): Promise<Record<string, Coords | null>> {
  const unique = [...new Set(places.map((p) => p.trim()).filter(Boolean))];
  const entries = await Promise.all(
    unique.map(async (p) => [p, await geocode(p)] as const)
  );
  return Object.fromEntries(entries);
}

export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Distance/duration estimate between two place names via geocoding:
 * straight-line distance × 1.35 road factor, driven at ~65 km/h + 15 min.
 * Returns null when either place can't be resolved.
 */
export async function estimateRouteByGeo(
  from: string,
  to: string
): Promise<{ distanceKm: number; durationMinutes: number } | null> {
  const [a, b] = await Promise.all([geocode(from), geocode(to)]);
  if (!a || !b) return null;
  const distanceKm = Math.round(haversineKm(a, b) * 1.35);
  const durationMinutes = Math.round((distanceKm / 65) * 60) + 15;
  return { distanceKm, durationMinutes };
}
