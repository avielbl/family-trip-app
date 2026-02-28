import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigation, Car, Clock, AlertCircle, RefreshCw, MapPin } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useTripContext } from '../context/TripContext';
import type { Hotel } from '../types/trip';

// Fix Leaflet default icon paths broken by Vite bundling
delete (L.Icon.Default.prototype as any)._getIconUrl;

// Fallback city coordinates for Northern Greece
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

function getHotelCoords(hotel: Hotel): [number, number] | null {
  if (hotel.lat != null && hotel.lng != null) return [hotel.lat, hotel.lng];
  return resolveCityCoords(hotel.city);
}

// Geocode a place string via Nominatim (fallback)
async function geocodePlace(place: string): Promise<[number, number] | null> {
  try {
    const q = encodeURIComponent(`${place}, Greece`);
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers: { 'User-Agent': 'FamilyTripApp/1.0' } },
    );
    const data = await resp.json();
    if (!data.length) return null;
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch {
    return null;
  }
}

interface RouteSegment {
  fromHotel: Hotel;
  toHotel: Hotel;
  path: [number, number][];   // [lat, lng] pairs
  distanceKm: number;
  durationMin: number;
}

// Fetch road route from OSRM demo server
async function fetchOSRMRoute(
  from: [number, number],
  to: [number, number],
): Promise<{ path: [number, number][]; distanceKm: number; durationMin: number } | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from[1]},${from[0]};${to[1]},${to[0]}` +
      `?overview=full&geometries=geojson`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.routes?.length) return null;
    const route = data.routes[0];
    const path: [number, number][] = route.geometry.coordinates.map(
      ([lon, lat]: [number, number]) => [lat, lon],
    );
    return {
      path,
      distanceKm: Math.round(route.legs[0].distance / 1000),
      durationMin: Math.round(route.legs[0].duration / 60),
    };
  } catch {
    return null;
  }
}

// Custom DivIcon for hotel markers (avoids Vite icon asset issues)
function makeHotelIcon(label: string, isFirst: boolean, isLast: boolean) {
  const color = isFirst ? '#16a34a' : isLast ? '#dc2626' : '#2563eb';
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${color};color:#fff;border-radius:50%;
      width:36px;height:36px;display:flex;align-items:center;justify-content:center;
      font-size:15px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.35);
      border:3px solid #fff;">${label}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

// ─── MapPage ──────────────────────────────────────────────────────────────────

const MapPage: React.FC = () => {
  const { t } = useTranslation();
  const { hotels } = useTripContext();
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [routes, setRoutes] = useState<RouteSegment[]>([]);
  const [resolvedCoords, setResolvedCoords] = useState<Map<string, [number, number]>>(new Map());
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [geocodingDone, setGeocodingDone] = useState(false);

  // Hotels sorted by check-in date
  const sortedHotels = useMemo(
    () =>
      [...hotels].sort(
        (a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime(),
      ),
    [hotels],
  );

  // Step 1: Resolve coordinates for every hotel
  useEffect(() => {
    if (sortedHotels.length === 0) return;
    (async () => {
      const coords = new Map<string, [number, number]>();
      for (const hotel of sortedHotels) {
        let c = getHotelCoords(hotel);
        if (!c) {
          // Try Nominatim geocoding as last resort
          const full = [hotel.name, hotel.address, hotel.city].filter(Boolean).join(', ');
          c = await geocodePlace(hotel.city || full);
        }
        if (c) coords.set(hotel.id, c);
      }
      setResolvedCoords(coords);
      setGeocodingDone(true);
    })();
  }, [sortedHotels]);

  // Step 2: Fetch OSRM routes between consecutive hotels
  useEffect(() => {
    if (!geocodingDone || sortedHotels.length < 2) return;
    (async () => {
      setLoadingRoutes(true);
      setRouteError(null);
      const segments: RouteSegment[] = [];
      for (let i = 0; i < sortedHotels.length - 1; i++) {
        const from = resolvedCoords.get(sortedHotels[i].id);
        const to = resolvedCoords.get(sortedHotels[i + 1].id);
        if (!from || !to) continue;
        const result = await fetchOSRMRoute(from, to);
        if (result) {
          segments.push({
            fromHotel: sortedHotels[i],
            toHotel: sortedHotels[i + 1],
            path: result.path,
            distanceKm: result.distanceKm,
            durationMin: result.durationMin,
          });
        }
      }
      setRoutes(segments);
      setLoadingRoutes(false);
    })();
  }, [geocodingDone, resolvedCoords, sortedHotels]);

  // Step 3: Initialise Leaflet map
  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return; // already initialised

    const map = L.map(containerRef.current, { zoomControl: true }).setView(
      [40.7, 22.5],
      8,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Step 4: Update map when hotels / routes change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geocodingDone) return;

    // Clear existing layers (except tile layer)
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
    });

    const bounds: [number, number][] = [];

    // Draw road routes
    routes.forEach((seg) => {
      if (seg.path.length > 1) {
        L.polyline(seg.path, {
          color: '#2563eb',
          weight: 4,
          opacity: 0.85,
        }).addTo(map);

        // Midpoint label with distance
        const mid = seg.path[Math.floor(seg.path.length / 2)];
        L.marker(mid, {
          icon: L.divIcon({
            className: '',
            html: `<div style="
              background:rgba(37,99,235,0.9);color:#fff;border-radius:12px;
              padding:2px 8px;font-size:11px;white-space:nowrap;
              box-shadow:0 1px 4px rgba(0,0,0,0.3);">
              ${seg.distanceKm} km · ${seg.durationMin} min</div>`,
            iconAnchor: [40, 10],
          }),
        }).addTo(map);

        seg.path.forEach((p) => bounds.push(p));
      }
    });

    // Place hotel markers
    sortedHotels.forEach((hotel, idx) => {
      const coords = resolvedCoords.get(hotel.id);
      if (!coords) return;
      bounds.push(coords);

      const isFirst = idx === 0;
      const isLast = idx === sortedHotels.length - 1;
      const icon = makeHotelIcon(String(idx + 1), isFirst, isLast);

      let checkInStr = '–';
      let checkOutStr = '–';
      try { checkInStr = format(parseISO(hotel.checkIn), 'MMM d'); } catch { /* */ }
      try { checkOutStr = format(parseISO(hotel.checkOut), 'MMM d'); } catch { /* */ }

      L.marker(coords, { icon })
        .addTo(map)
        .bindPopup(
          `<div style="min-width:160px">
            <strong>${hotel.name || hotel.city}</strong><br/>
            <span style="color:#6b7280">${hotel.city}</span><br/>
            <span style="font-size:12px">📅 ${checkInStr} – ${checkOutStr}</span>
            ${hotel.address ? `<br/><span style="font-size:11px;color:#9ca3af">${hotel.address}</span>` : ''}
          </div>`,
        );
    });

    // Fit map to all markers + routes
    if (bounds.length > 0) {
      map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40] });
    }
  }, [geocodingDone, resolvedCoords, routes, sortedHotels]);

  const hotelsWithoutCoords = sortedHotels.filter(
    (h) => geocodingDone && !resolvedCoords.has(h.id),
  );

  return (
    <div className="map-page">
      <h1 className="page-title">{t('map.title')}</h1>

      {/* Route summary legend */}
      <div className="map-legend">
        <span className="map-legend-item">
          <span className="map-legend-dot green" /> Start
        </span>
        <span className="map-legend-item">
          <span className="map-legend-dot blue" /> Hotel
        </span>
        <span className="map-legend-item">
          <span className="map-legend-dot red" /> Last hotel
        </span>
      </div>

      {/* Loading / error states */}
      {loadingRoutes && (
        <div className="map-status">
          <RefreshCw size={14} className="spin" />
          <span>Calculating road routes…</span>
        </div>
      )}
      {routeError && (
        <div className="map-status error">
          <AlertCircle size={14} /> {routeError}
        </div>
      )}

      {/* The map */}
      <div ref={containerRef} className="map-container" />

      {/* Hotels without coordinates */}
      {hotelsWithoutCoords.length > 0 && (
        <div className="map-missing-coords">
          <AlertCircle size={14} />
          <div>
            <strong>Hotels missing coordinates (not shown on map):</strong>
            <ul>
              {hotelsWithoutCoords.map((h) => (
                <li key={h.id}>
                  {h.name} — {h.city} (add lat/lng in Hotels page)
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Route summary cards */}
      {routes.length > 0 && (
        <div className="map-routes-list">
          <h2 className="section-title">Route Summary</h2>
          {routes.map((seg, i) => {
            const fromName = seg.fromHotel.name || seg.fromHotel.city;
            const toName = seg.toHotel.name || seg.toHotel.city;
            return (
              <div key={i} className="map-route-card card">
                <div className="map-route-header">
                  <Navigation size={15} />
                  <span className="map-route-from">{fromName}</span>
                  <span className="map-route-arrow">→</span>
                  <span className="map-route-to">{toName}</span>
                </div>
                <div className="map-route-info">
                  <span className="map-route-stat">
                    <Car size={13} /> {seg.distanceKm} km
                  </span>
                  <span className="map-route-stat">
                    <Clock size={13} /> {seg.durationMin} min
                  </span>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(seg.fromHotel.city)}&destination=${encodeURIComponent(seg.toHotel.city)}&travelmode=driving`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="map-route-gmaps"
                  >
                    <MapPin size={12} /> Open in Maps
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sortedHotels.length === 0 && (
        <div className="map-no-hotels">
          No hotels added yet. Add hotels to see them on the map.
        </div>
      )}
    </div>
  );
};

export default MapPage;
