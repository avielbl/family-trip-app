import { useEffect, useRef, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Building2, Star, Layers, UtensilsCrossed } from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import type { Hotel, Highlight, Restaurant } from '../types/trip';

// ─── City coords fallback ─────────────────────────────────────────────────────

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  // ── Actual trip: March–April 2026 ────────────────────────────────
  'ioannina': { lat: 39.6650, lng: 20.8527 },
  'yioannina': { lat: 39.6650, lng: 20.8527 },
  'zagoria': { lat: 39.8900, lng: 20.7300 },
  'zagori': { lat: 39.8900, lng: 20.7300 },
  'kipi': { lat: 39.8640, lng: 20.7380 },
  'kipoi': { lat: 39.8640, lng: 20.7380 },
  'monodendri': { lat: 39.9040, lng: 20.7330 },
  'papigo': { lat: 39.9880, lng: 20.7240 },
  'voidomatis': { lat: 39.9050, lng: 20.7650 },
  'vikos': { lat: 39.8985, lng: 20.7200 },
  'metsovo': { lat: 39.7710, lng: 21.1830 },
  'tsoumerka': { lat: 39.4720, lng: 21.0540 },
  'kipina': { lat: 39.4720, lng: 21.0540 },
  'pramenti': { lat: 39.5060, lng: 21.0730 },
  'pertouli': { lat: 39.4730, lng: 21.4510 },
  'palaios agios athanasios': { lat: 40.8810, lng: 22.1460 },
  'palaios': { lat: 40.8810, lng: 22.1460 },
  'pozar': { lat: 40.9670, lng: 22.0430 },
  'loutraki': { lat: 40.9670, lng: 22.0430 },
  'aridaia': { lat: 40.9750, lng: 22.0590 },
  'edessa': { lat: 40.8005, lng: 22.0510 },
  'thessaloniki': { lat: 40.6401, lng: 22.9444 },
  'skg': { lat: 40.5196, lng: 22.9720 },
  'imathia': { lat: 40.5300, lng: 22.1200 },
  // ── Legacy / other Greek cities ──────────────────────────────────
  'athens': { lat: 37.9838, lng: 23.7275 },
  'athina': { lat: 37.9838, lng: 23.7275 },
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
};

function getCityCoords(text: string): { lat: number; lng: number } | null {
  const key = text.toLowerCase().trim();
  for (const [name, coords] of Object.entries(CITY_COORDS)) {
    if (key.includes(name) || name.includes(key)) return coords;
  }
  return null;
}

function getHotelCoords(hotel: Hotel): { lat: number; lng: number } | null {
  if (hotel.lat && hotel.lng) return { lat: hotel.lat, lng: hotel.lng };
  return getCityCoords(hotel.city || hotel.name);
}

function getHighlightCoords(hl: Highlight): { lat: number; lng: number } | null {
  if (hl.lat && hl.lng) return { lat: hl.lat, lng: hl.lng };
  if (hl.address) {
    const c = getCityCoords(hl.address);
    if (c) return c;
  }
  if (hl.description) {
    const c = getCityCoords(hl.description);
    if (c) return c;
  }
  if (hl.name) return getCityCoords(hl.name);
  return null;
}

function getRestaurantCoords(r: Restaurant): { lat: number; lng: number } | null {
  if (r.lat && r.lng) return { lat: r.lat, lng: r.lng };
  if (r.city) return getCityCoords(r.city);
  if (r.address) return getCityCoords(r.address);
  return null;
}

// ─── Category icon colors ─────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  beach: '#0ea5e9',
  ruins: '#b45309',
  museum: '#7c3aed',
  food: '#dc2626',
  'kids-fun': '#16a34a',
  nature: '#15803d',
  shopping: '#db2777',
  viewpoint: '#ea580c',
  other: '#6b7280',
};

// ─── Tile layers ──────────────────────────────────────────────────────────────

const TILE_LAYERS = {
  streets: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© <a href="https://www.esri.com">Esri</a>',
    maxZoom: 19,
  },
};

// ─── Map Legend data ──────────────────────────────────────────────────────────

const LEGEND_ITEMS = [
  { color: '#1d4ed8', label: 'Hotel', labelHe: 'מלון' },
  { color: '#16a34a', label: 'Restaurant', labelHe: 'מסעדה' },
  { color: '#0ea5e9', label: 'Beach', labelHe: 'חוף' },
  { color: '#b45309', label: 'Ruins / Historic', labelHe: 'חורבות' },
  { color: '#7c3aed', label: 'Museum', labelHe: 'מוזיאון' },
  { color: '#15803d', label: 'Nature', labelHe: 'טבע' },
  { color: '#ea580c', label: 'Viewpoint', labelHe: 'תצפית' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function TripMapPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const { hotels, highlights, restaurants } = useTripContext();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const tileLayerRef = useRef<import('leaflet').TileLayer | null>(null);
  const [tileMode, setTileMode] = useState<'streets' | 'satellite'>('streets');

  // Sorted hotels by check-in date (defines the route)
  const sortedHotels = useMemo(
    () => [...hotels].sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime()),
    [hotels]
  );

  // Hotel coords
  const hotelPoints = useMemo(
    () =>
      sortedHotels
        .map((h) => {
          const c = getHotelCoords(h);
          return c ? { hotel: h, lat: c.lat, lng: c.lng } : null;
        })
        .filter(Boolean) as { hotel: Hotel; lat: number; lng: number }[],
    [sortedHotels]
  );

  // Highlight coords
  const highlightPoints = useMemo(
    () =>
      highlights
        .map((hl) => {
          const c = getHighlightCoords(hl);
          return c ? { highlight: hl, lat: c.lat, lng: c.lng } : null;
        })
        .filter(Boolean) as { highlight: Highlight; lat: number; lng: number }[],
    [highlights]
  );

  // Restaurant coords
  const restaurantPoints = useMemo(
    () =>
      restaurants
        .map((r) => {
          const c = getRestaurantCoords(r);
          return c ? { restaurant: r, lat: c.lat, lng: c.lng } : null;
        })
        .filter(Boolean) as { restaurant: Restaurant; lat: number; lng: number }[],
    [restaurants]
  );

  // Default center: Northern Greece (actual trip area)
  const defaultCenter: [number, number] = [40.2, 21.8];
  const defaultZoom = 7;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Dynamically import leaflet to avoid SSR issues
    import('leaflet').then((L) => {
      // Fix default marker icons
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(mapContainerRef.current!, {
        center: defaultCenter,
        zoom: defaultZoom,
        zoomControl: true,
      });
      mapRef.current = map;

      // Initial tile layer (streets)
      const tl = L.tileLayer(TILE_LAYERS.streets.url, {
        attribution: TILE_LAYERS.streets.attribution,
        maxZoom: TILE_LAYERS.streets.maxZoom,
      });
      tl.addTo(map);
      tileLayerRef.current = tl;

      const allLatLngs: [number, number][] = [];

      // ── Hotel markers (blue) ──────────────────────────────────────
      const hotelIcon = (index: number) =>
        L.divIcon({
          className: '',
          html: `<div style="
            background:#1d4ed8;color:#fff;
            border:2px solid #fff;border-radius:50%;
            width:32px;height:32px;display:flex;
            align-items:center;justify-content:center;
            font-size:13px;font-weight:700;
            box-shadow:0 2px 8px rgba(0,0,0,0.3);
          ">${index + 1}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -20],
        });

      hotelPoints.forEach((pt, i) => {
        allLatLngs.push([pt.lat, pt.lng]);
        const checkIn = pt.hotel.checkIn
          ? new Date(pt.hotel.checkIn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          : '';
        const checkOut = pt.hotel.checkOut
          ? new Date(pt.hotel.checkOut).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          : '';

        L.marker([pt.lat, pt.lng], { icon: hotelIcon(i) })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:Inter,sans-serif;min-width:160px;">
              <strong style="color:#1d4ed8">🏨 ${pt.hotel.name}</strong><br/>
              <span style="color:#6b7280;font-size:12px">${pt.hotel.city}</span><br/>
              ${checkIn ? `<span style="font-size:12px">${checkIn} → ${checkOut}</span>` : ''}
              ${pt.hotel.confirmationCode ? `<br/><span style="font-size:11px;color:#6b7280">✓ ${pt.hotel.confirmationCode}</span>` : ''}
            </div>`
          );
      });

      // ── Route polyline between hotels ──────────────────────────────
      if (hotelPoints.length > 1) {
        const routeLatLngs = hotelPoints.map((pt) => [pt.lat, pt.lng] as [number, number]);
        L.polyline(routeLatLngs, {
          color: '#1d4ed8',
          weight: 3,
          opacity: 0.7,
          dashArray: '8, 6',
        }).addTo(map);
      }

      // ── Highlight markers (colored circles) ───────────────────────
      highlightPoints.forEach((pt) => {
        const color = CATEGORY_COLORS[pt.highlight.category] || '#6b7280';
        const hl = pt.highlight;
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            background:${color};color:#fff;
            border:2px solid #fff;border-radius:50%;
            width:22px;height:22px;display:flex;
            align-items:center;justify-content:center;
            font-size:10px;
            box-shadow:0 2px 6px rgba(0,0,0,0.25);
          ">★</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
          popupAnchor: [0, -14],
        });

        allLatLngs.push([pt.lat, pt.lng]);
        L.marker([pt.lat, pt.lng], { icon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:Inter,sans-serif;min-width:140px;">
              <strong style="color:${color}">${hl.name}</strong><br/>
              <span style="font-size:11px;color:#6b7280;text-transform:capitalize">${hl.category}</span>
              ${hl.description ? `<br/><span style="font-size:12px">${hl.description.slice(0, 80)}${hl.description.length > 80 ? '…' : ''}</span>` : ''}
              ${hl.completed ? '<br/><span style="font-size:11px;color:#16a34a">✓ Visited</span>' : ''}
            </div>`
          );
      });

      // ── Restaurant markers (green fork) ───────────────────────────
      restaurantPoints.forEach((pt) => {
        const r = pt.restaurant;
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            background:#16a34a;color:#fff;
            border:2px solid #fff;border-radius:50%;
            width:22px;height:22px;display:flex;
            align-items:center;justify-content:center;
            font-size:12px;
            box-shadow:0 2px 6px rgba(0,0,0,0.25);
          ">🍴</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
          popupAnchor: [0, -14],
        });

        allLatLngs.push([pt.lat, pt.lng]);
        L.marker([pt.lat, pt.lng], { icon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:Inter,sans-serif;min-width:140px;">
              <strong style="color:#16a34a">🍴 ${r.name}</strong><br/>
              ${r.cuisine ? `<span style="font-size:11px;color:#6b7280">${r.cuisine}</span><br/>` : ''}
              ${r.city ? `<span style="font-size:11px;color:#6b7280">${r.city}</span>` : ''}
              ${r.priceRange ? `<br/><span style="font-size:11px">${r.priceRange}</span>` : ''}
              ${r.visited ? '<br/><span style="font-size:11px;color:#16a34a">✓ Visited</span>' : ''}
            </div>`
          );
      });

      // ── Fit bounds to all markers ─────────────────────────────────
      if (allLatLngs.length === 0) {
        // No data yet — show default Greece overview
        map.setView(defaultCenter, defaultZoom);
      } else if (allLatLngs.length === 1) {
        // Single marker — use moderate zoom
        map.setView(allLatLngs[0], 12);
      } else {
        // Multiple markers — fit all, cap zoom so we don't end up street-level
        map.fitBounds(allLatLngs, { padding: [40, 40], maxZoom: 13 });
      }
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [hotelPoints, highlightPoints, restaurantPoints]);

  // Handle tile layer toggle without rebuilding the map
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    import('leaflet').then((L) => {
      if (!mapRef.current) return;
      tileLayerRef.current?.remove();
      const cfg = TILE_LAYERS[tileMode];
      const tl = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: cfg.maxZoom });
      tl.addTo(mapRef.current);
      tileLayerRef.current = tl;
    });
  }, [tileMode]);

  return (
    <div className="trip-map-page">
      <h1 className="page-title">
        {isRTL ? 'מפת הטיול' : 'Trip Map'}
      </h1>
      <p className="page-subtitle">
        {isRTL
          ? 'מפה מלאה של הטיול עם מלונות, אטרקציות ומסלול הנסיעה'
          : 'Full trip map with hotels, highlights, restaurants, and driving route'}
      </p>

      {/* ─── Map Container ──────────────────────────────────────── */}
      <div style={{ position: 'relative' }}>
        <div className="map-container" ref={mapContainerRef} />
        {/* Satellite toggle button */}
        <button
          className="map-layer-toggle"
          onClick={() => setTileMode((m) => m === 'streets' ? 'satellite' : 'streets')}
          title={tileMode === 'streets' ? 'Switch to satellite' : 'Switch to streets'}
        >
          <Layers size={16} />
          <span>{tileMode === 'streets' ? (isRTL ? 'לוויין' : 'Satellite') : (isRTL ? 'רחובות' : 'Streets')}</span>
        </button>
      </div>

      {/* ─── Legend ─────────────────────────────────────────────── */}
      <div className="map-legend">
        <h3 className="map-legend-title">{isRTL ? 'מקרא' : 'Legend'}</h3>
        <div className="map-legend-grid">
          <div className="legend-item">
            <div className="legend-dot" style={{ background: '#1d4ed8', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>1</div>
            <span>{isRTL ? 'מלון (ממוספר לפי סדר)' : 'Hotel (numbered in order)'}</span>
          </div>
          {LEGEND_ITEMS.slice(1).map((item) => (
            <div key={item.label} className="legend-item">
              <div className="legend-dot" style={{ background: item.color, width: 18, height: 18, borderRadius: '50%' }} />
              <span>{isRTL ? item.labelHe : item.label}</span>
            </div>
          ))}
          <div className="legend-item">
            <div style={{ width: 36, height: 4, background: '#1d4ed8', borderRadius: 2, opacity: 0.7, marginRight: 4 }} />
            <span>{isRTL ? 'מסלול נסיעה' : 'Driving route'}</span>
          </div>
        </div>
      </div>

      {/* ─── Empty state notice ──────────────────────────────────── */}
      {hotels.length === 0 && highlights.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '20px 16px',
          background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
          color: 'var(--text-muted)', fontSize: '14px', margin: '12px 0',
        }}>
          {isRTL
            ? 'אין נתונים עדיין — עבור לניהול → "טען תוכן טיול" כדי לאכלס את המפה'
            : 'No data yet — go to Admin → "Seed Trip Content" to populate the map'}
        </div>
      )}

      {/* ─── Hotel List ──────────────────────────────────────────── */}
      {hotelPoints.length > 0 && (
        <div className="map-hotel-list">
          <h3 className="map-section-title">
            <Building2 size={16} />
            {isRTL ? 'מלונות בטיול' : 'Trip Hotels'}
          </h3>
          {hotelPoints.map((pt, i) => (
            <div key={pt.hotel.id} className="map-hotel-row">
              <div className="map-hotel-number">{i + 1}</div>
              <div className="map-hotel-info">
                <span className="map-hotel-name">{pt.hotel.name}</span>
                <span className="map-hotel-city">{pt.hotel.city}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Stats ───────────────────────────────────────────────── */}
      <div className="map-stats">
        <div className="map-stat">
          <Building2 size={20} color="#1d4ed8" />
          <span className="map-stat-num">{hotels.length}</span>
          <span className="map-stat-label">{isRTL ? 'מלונות' : 'Hotels'}</span>
        </div>
        <div className="map-stat">
          <Star size={20} color="#f59e0b" />
          <span className="map-stat-num">{highlights.length}</span>
          <span className="map-stat-label">{isRTL ? 'אטרקציות' : 'Highlights'}</span>
        </div>
        <div className="map-stat">
          <UtensilsCrossed size={20} color="#16a34a" />
          <span className="map-stat-num">{restaurants.length}</span>
          <span className="map-stat-label">{isRTL ? 'מסעדות' : 'Restaurants'}</span>
        </div>
        <div className="map-stat">
          <MapPin size={20} color="#6b7280" />
          <span className="map-stat-num">{new Set(hotels.map((h) => h.city)).size}</span>
          <span className="map-stat-label">{isRTL ? 'ערים' : 'Cities'}</span>
        </div>
      </div>
    </div>
  );
}
