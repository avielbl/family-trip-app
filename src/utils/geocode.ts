// Shared place-name → coordinates resolution for any trip destination.
// Resolution order: trip-agnostic seed table (instant) → localStorage cache →
// free Open-Meteo geocoding API (cached). Used by the map, weather, and
// driving-route estimation so every feature follows the active trip.
//
// Route estimation asks a real road router (OSRM) for the driving distance and
// falls back to a geometric estimate only when routing is unavailable. Nothing
// here ever invents a distance: an unresolvable route returns null.

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

// IATA codes resolve to the airport itself, not the city centre. Only consulted
// as a fallback when the airport's written name can't be geocoded — extend as
// new trips add airports.
const AIRPORT_COORDS: Record<string, Coords> = {
  tiv: { lat: 42.4047, lng: 18.7233 }, // Tivat, Montenegro
  tgd: { lat: 42.3594, lng: 19.2519 }, // Podgorica, Montenegro
  dbv: { lat: 42.5614, lng: 18.2682 }, // Dubrovnik, Croatia
  tlv: { lat: 32.0114, lng: 34.8867 }, // Ben Gurion, Israel
  skg: { lat: 40.5197, lng: 22.9709 }, // Thessaloniki, Greece
  ath: { lat: 37.9364, lng: 23.9445 }, // Athens, Greece
};

/**
 * Where this trip actually is. Place names are wildly ambiguous — Montenegro
 * alone has a city called Bar — and a gazetteer's first global match for one
 * can land on another continent. When an anchor is set, several candidates are
 * fetched and the nearest to it wins.
 *
 * Deliberately derived from the trip's own hotel coordinates rather than its
 * countryCode: that field defaults to 'GR' for trips migrated from the earlier
 * Greece-only version, so it cannot be trusted to describe where a trip is.
 */
let geocodeAnchor: Coords | null = null;

export function setGeocodeAnchor(coords: Coords | null): void {
  geocodeAnchor = coords && validCoords(coords) ? coords : null;
}

/** Cache bucket, so switching trips cannot serve another region's answers. */
function anchorKey(): string {
  return geocodeAnchor
    ? `${Math.round(geocodeAnchor.lat)},${Math.round(geocodeAnchor.lng)}`
    : 'anywhere';
}

const GEOCODE_CACHE_KEY = 'geocodeCache.v2';

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

/** True when `needle` appears in `haystack` as a whole word, not mid-word. */
function containsWord(haystack: string, needle: string): boolean {
  let from = 0;
  for (;;) {
    const i = haystack.indexOf(needle, from);
    if (i < 0) return false;
    const before = i === 0 ? '' : haystack[i - 1];
    const after = haystack[i + needle.length] ?? '';
    if (!/[a-z]/.test(before) && !/[a-z]/.test(after)) return true;
    from = i + 1;
  }
}

/**
 * Synchronous best-effort lookup: seed table (whole-word match) or cache hit.
 * Matching is whole-word in both directions so a short name can't latch onto an
 * unrelated city ("por" must not resolve to "Pozar").
 */
export function cachedCoords(place: string): Coords | null {
  const key = place.toLowerCase().trim();
  if (!key) return null;
  for (const [name, coords] of Object.entries(SEED_CITY_COORDS)) {
    if (containsWord(key, name) || containsWord(name, key)) return coords;
  }
  const cached = readCache()[key];
  return cached ?? null;
}

/** Coordinates for a bare IATA airport code, if we know that airport. */
export function airportCoords(code: string): Coords | null {
  return AIRPORT_COORDS[code.toLowerCase().trim()] ?? null;
}

const AIRPORT_WORDS =
  /\b(international|intl\.?|regional|municipal|national|airport|airfield|aerodrome|terminal)\b/gi;

/**
 * Search strings to try for a place, best first. The geocoding API indexes
 * populated places, so "Tivat Airport (TIV)" only resolves once it is reduced
 * to "Tivat", and "Hotel Splendid, Budva" only once reduced to "Budva".
 */
export function placeSearchVariants(place: string): string[] {
  const variants: string[] = [];
  const push = (value: string) => {
    const clean = value.replace(/\s{2,}/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '');
    if (clean && !variants.some((v) => v.toLowerCase() === clean.toLowerCase())) {
      variants.push(clean);
    }
  };

  const raw = place.trim();
  push(raw);
  const noParens = raw.replace(/\([^)]*\)/g, ' ');
  push(noParens);
  const noAirportWords = noParens.replace(AIRPORT_WORDS, ' ');
  push(noAirportWords);
  // Drop a bare IATA code appended to the name ("Tivat Airport TIV" → "Tivat"),
  // which no gazetteer of populated places will match.
  push(noAirportWords.replace(/\b[A-Z]{3}\b/g, ' '));

  // "Hotel Splendid, Bečići, Budva" — the last comma-separated part is the
  // broadest (and most geocodable) location; the first is the most specific.
  const parts = noParens.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) {
    push(parts[parts.length - 1]);
    push(parts[parts.length - 1].replace(AIRPORT_WORDS, ' '));
    push(parts[0]);
  }
  return variants;
}

/** Single geocoding API call. Returns null on miss, error, or offline. */
async function fetchCoords(name: string): Promise<Coords | null> {
  try {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.set('name', name);
    // With an anchor, ask for a shortlist and pick the nearest match rather
    // than trusting whichever the gazetteer happens to rank first.
    url.searchParams.set('count', geocodeAnchor ? '10' : '1');
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const results = (data.results ?? []) as Array<{ latitude: number; longitude: number }>;
    if (!results.length) return null;

    const candidates = results
      .map((r) => ({ lat: r.latitude, lng: r.longitude }))
      .filter(validCoords);
    if (!candidates.length) return null;
    if (!geocodeAnchor) return candidates[0];

    return candidates.reduce((best, c) =>
      haversineKm(c, geocodeAnchor!) < haversineKm(best, geocodeAnchor!) ? c : best
    );
  } catch {
    return null;
  }
}

/**
 * Resolve a place name to coordinates, hitting the network at most once per
 * name. Progressively simpler variants of the name are tried before giving up,
 * so airport and hotel strings resolve instead of silently missing.
 */
export async function geocode(place: string): Promise<Coords | null> {
  const key = place.toLowerCase().trim();
  if (!key) return null;
  const instant = cachedCoords(place);
  if (instant) return instant;
  const cache = readCache();
  const cacheKey = `${anchorKey()}|${key}`;
  if (cacheKey in cache) return cache[cacheKey]; // includes cached "not found" (null)

  let coords: Coords | null = null;
  for (const variant of placeSearchVariants(place)) {
    coords = cachedCoords(variant) ?? (await fetchCoords(variant));
    if (coords) break;
  }
  // Last resort: a bare IATA code ("TIV") that no gazetteer will match.
  if (!coords) {
    for (const token of key.split(/[^a-z]+/)) {
      if (token.length === 3 && AIRPORT_COORDS[token]) {
        coords = AIRPORT_COORDS[token];
        break;
      }
    }
  }
  // Only remember answers decided with the trip's location in hand. Caching a
  // guess made before the trip is known would pin the wrong place for the
  // whole session, since a later lookup would just hit the cache.
  if (geocodeAnchor) {
    cache[cacheKey] = coords;
    writeCache(cache);
  }
  return coords;
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

export interface RouteEstimate {
  distanceKm: number;
  durationMinutes: number;
  /** 'road' came from a real router; 'geometric' is a straight-line estimate. */
  source: 'road' | 'geometric';
}

/**
 * A route endpoint: known coordinates win, otherwise the name is geocoded.
 * Hotels and flights usually carry better data than their display string.
 */
export interface PlaceRef {
  name: string;
  coords?: Coords | null;
}

function validCoords(c: Coords | null | undefined): c is Coords {
  return (
    !!c &&
    Number.isFinite(c.lat) &&
    Number.isFinite(c.lng) &&
    Math.abs(c.lat) <= 90 &&
    Math.abs(c.lng) <= 180 &&
    !(c.lat === 0 && c.lng === 0)
  );
}

/** Resolve an endpoint to coordinates, preferring coordinates already on hand. */
export async function resolvePlace(place: PlaceRef | string): Promise<Coords | null> {
  if (typeof place === 'string') return geocode(place);
  if (validCoords(place.coords)) return place.coords;
  return place.name ? geocode(place.name) : null;
}

/**
 * Actual driving distance/duration from the public OSRM router.
 * Returns null when the router is unreachable or has no route (e.g. a ferry
 * hop or an island with no road link).
 */
export async function roadRoute(a: Coords, b: Coords): Promise<RouteEstimate | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${a.lng},${a.lat};${b.lng},${b.lat}?overview=false&alternatives=false`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0];
    if (typeof route?.distance !== 'number' || typeof route?.duration !== 'number') {
      return null;
    }
    return {
      distanceKm: Math.max(1, Math.round(route.distance / 1000)),
      durationMinutes: Math.max(5, Math.round(route.duration / 60)),
      source: 'road',
    };
  } catch {
    return null;
  }
}

/**
 * Straight-line fallback. The detour factor and average speed both scale with
 * distance: short transfers are mostly slow town roads, long hauls are mostly
 * highway, so a single factor/speed pair misestimates one end or the other.
 */
export function geometricRoute(a: Coords, b: Coords): RouteEstimate {
  const straight = haversineKm(a, b);
  const detour = straight < 10 ? 1.4 : straight < 50 ? 1.3 : 1.25;
  const distanceKm = Math.max(1, Math.round(straight * detour));
  const speed = distanceKm < 10 ? 35 : distanceKm < 50 ? 55 : distanceKm < 150 ? 70 : 80;
  const buffer = distanceKm < 25 ? 5 : 10;
  return {
    distanceKm,
    durationMinutes: Math.max(5, Math.round((distanceKm / speed) * 60) + buffer),
    source: 'geometric',
  };
}

/**
 * Distance/duration between two places: real road routing when both endpoints
 * resolve, geometric estimate when the router is unavailable.
 * Returns null when either endpoint can't be located — callers must leave the
 * distance blank rather than substitute a made-up number.
 */
export async function estimateRouteByGeo(
  from: PlaceRef | string,
  to: PlaceRef | string
): Promise<RouteEstimate | null> {
  const [a, b] = await Promise.all([resolvePlace(from), resolvePlace(to)]);
  if (!a || !b) return null;
  return (await roadRoute(a, b)) ?? geometricRoute(a, b);
}
