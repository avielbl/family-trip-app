import React, { useMemo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Calendar,
  Wifi,
  Phone,
  MapPin,
  Copy,
  ExternalLink,
  Check,
  Hash,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTripContext } from '../context/TripContext';
import { saveHotel, deleteHotel } from '../firebase/tripService';
import type { Hotel } from '../types/trip';
import AIImportModal from '../components/AIImportModal';

function emptyHotel(): Hotel {
  return {
    id: `hotel-${Date.now()}`,
    dayIndexStart: 0,
    dayIndexEnd: 1,
    name: '',
    address: '',
    city: '',
    checkIn: '',
    checkOut: '',
  };
}

const HotelsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { hotels, tripCode, isAdmin } = useTripContext();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<Hotel | null>(null);
  const [showImport, setShowImport] = useState(false);
  const isHe = i18n.language === 'he';

  const sortedHotels = useMemo(() => {
    return [...hotels].sort(
      (a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime()
    );
  }, [hotels]);

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'EEE, MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'HH:mm');
    } catch {
      return dateStr;
    }
  };

  const handleCopyWifi = useCallback(async (hotelId: string, password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      setCopiedId(hotelId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = password;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedId(hotelId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  const getNavigationUrl = (hotel: { mapUrl?: string; address: string; city: string }) => {
    if (hotel.mapUrl) {
      return hotel.mapUrl;
    }
    const query = encodeURIComponent(`${hotel.address}, ${hotel.city}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  };

  async function handleSave(h: Hotel) {
    if (!tripCode) return;
    await saveHotel(tripCode, h);
    setEditItem(null);
  }

  async function handleDelete(id: string) {
    if (!tripCode) return;
    if (!confirm(isHe ? 'למחוק מלון זה?' : 'Delete this hotel?')) return;
    await deleteHotel(tripCode, id);
  }

  async function handleImportHotels(items: Record<string, unknown>[]) {
    if (!tripCode) return;
    for (const item of items) {
      const hotel: Hotel = {
        id: `hotel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        dayIndexStart: Number(item.dayIndexStart ?? 0),
        dayIndexEnd: Number(item.dayIndexEnd ?? 1),
        name: String(item.name ?? ''),
        address: String(item.address ?? ''),
        city: String(item.city ?? ''),
        checkIn: String(item.checkIn ?? ''),
        checkOut: String(item.checkOut ?? ''),
        confirmationCode: item.confirmationCode ? String(item.confirmationCode) : undefined,
        wifiPassword: item.wifiPassword ? String(item.wifiPassword) : undefined,
        phone: item.phone ? String(item.phone) : undefined,
        email: item.email ? String(item.email) : undefined,
        notes: item.notes ? String(item.notes) : undefined,
      };
      await saveHotel(tripCode, hotel);
    }
    setShowImport(false);
  }

  return (
    <div className="hotels-page">
      <h1 className="page-title">{t('hotels.title')}</h1>

      {isAdmin && (
        <div className="admin-add-bar">
          <button className="admin-icon-btn add" onClick={() => setEditItem(emptyHotel())}>
            <Plus size={14} /> {isHe ? 'הוסף מלון' : 'Add Hotel'}
          </button>
          <button className="admin-icon-btn ai-import-btn" onClick={() => setShowImport(true)}>
            <Sparkles size={14} /> {isHe ? 'ייבוא AI' : 'AI Import'}
          </button>
        </div>
      )}

      <div className="hotels-list">
        {sortedHotels.map((hotel) => (
          <div key={hotel.id} className="hotel-card">
            {hotel.imageUrl && (
              <div className="hotel-image">
                <img src={hotel.imageUrl} alt={hotel.name} loading="lazy" />
              </div>
            )}

            <div className="hotel-card-content">
              <div className="hotel-header">
                <Building2 size={20} />
                <div>
                  <h2 className="hotel-name">{hotel.name}</h2>
                  <span className="hotel-city">{hotel.city}</span>
                </div>
              </div>

              <div className="hotel-dates">
                <div className="hotel-date-row">
                  <Calendar size={14} />
                  <span className="date-label">{t('hotels.checkIn')}:</span>
                  <span className="date-value">
                    {formatDate(hotel.checkIn)} &middot; {formatTime(hotel.checkIn)}
                  </span>
                </div>
                <div className="hotel-date-row">
                  <Calendar size={14} />
                  <span className="date-label">{t('hotels.checkOut')}:</span>
                  <span className="date-value">
                    {formatDate(hotel.checkOut)} &middot; {formatTime(hotel.checkOut)}
                  </span>
                </div>
              </div>

              <div className="hotel-details-grid">
                {hotel.confirmationCode && (
                  <div className="hotel-detail">
                    <Hash size={14} />
                    <span className="detail-label">{t('hotels.confirmation')}:</span>
                    <span className="detail-value confirmation-code">
                      {hotel.confirmationCode}
                    </span>
                  </div>
                )}

                {hotel.wifiPassword && (
                  <div className="hotel-detail">
                    <Wifi size={14} />
                    <span className="detail-label">{t('hotels.wifi')}:</span>
                    <span className="detail-value">{hotel.wifiPassword}</span>
                    <button
                      className="copy-btn"
                      onClick={() => handleCopyWifi(hotel.id, hotel.wifiPassword!)}
                      title="Copy WiFi password"
                    >
                      {copiedId === hotel.id ? (
                        <Check size={14} />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                )}

                {hotel.phone && (
                  <div className="hotel-detail">
                    <Phone size={14} />
                    <span className="detail-label">{t('hotels.phone')}:</span>
                    <a href={`tel:${hotel.phone}`} className="detail-value phone-link">
                      {hotel.phone}
                    </a>
                  </div>
                )}

                {hotel.email && (
                  <div className="hotel-detail">
                    <FileText size={14} />
                    <span className="detail-label">Email:</span>
                    <a href={`mailto:${hotel.email}`} className="detail-value email-link">
                      {hotel.email}
                    </a>
                  </div>
                )}
              </div>

              {hotel.notes && (
                <div className="hotel-notes">
                  <FileText size={14} />
                  <span>{hotel.notes}</span>
                </div>
              )}

              <a
                href={getNavigationUrl(hotel)}
                target="_blank"
                rel="noopener noreferrer"
                className="navigate-btn"
              >
                <MapPin size={16} />
                <span>{t('hotels.navigate')}</span>
                <ExternalLink size={14} />
              </a>

              {isAdmin && (
                <div className="admin-controls">
                  <button className="admin-icon-btn edit" onClick={() => setEditItem(hotel)}>
                    <Pencil size={13} /> {t('common.edit')}
                  </button>
                  <button className="admin-icon-btn delete" onClick={() => handleDelete(hotel.id)}>
                    <Trash2 size={13} /> {t('common.delete')}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {editItem && (
        <HotelModal hotel={editItem} isHe={isHe} onSave={handleSave} onClose={() => setEditItem(null)} t={t} />
      )}

      {showImport && (
        <AIImportModal
          target="hotel"
          onAccept={handleImportHotels}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
};

function HotelModal({ hotel, isHe, onSave, onClose, t }: {
  hotel: Hotel; isHe: boolean;
  onSave: (h: Hotel) => void; onClose: () => void;
  t: (k: string) => string;
}) {
  const [form, setForm] = useState({ ...hotel });
  function set(field: keyof Hotel, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{isHe ? (hotel.name ? 'ערוך מלון' : 'הוסף מלון') : (hotel.name ? 'Edit Hotel' : 'Add Hotel')}</div>
        {([
          ['name', isHe ? 'שם' : 'Name'],
          ['city', isHe ? 'עיר' : 'City'],
          ['address', isHe ? 'כתובת' : 'Address'],
          ['checkIn', isHe ? 'צ\'ק-אין (ISO)' : 'Check-in (ISO)'],
          ['checkOut', isHe ? 'צ\'ק-אאוט (ISO)' : 'Check-out (ISO)'],
          ['confirmationCode', isHe ? 'קוד אישור' : 'Confirmation Code'],
          ['wifiPassword', isHe ? 'סיסמת WiFi' : 'WiFi Password'],
          ['phone', isHe ? 'טלפון' : 'Phone'],
          ['notes', isHe ? 'הערות' : 'Notes'],
        ] as [keyof Hotel, string][]).map(([field, label]) => (
          <div className="form-group" key={field}>
            <label className="form-label">{label}</label>
            <input className="form-input" value={(form as any)[field] ?? ''} onChange={(e) => set(field, e.target.value)} />
          </div>
        ))}
        <div className="modal-actions">
          <button className="admin-btn secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button className="admin-btn primary" onClick={() => onSave(form)}>{t('common.save')}</button>
        </div>
      </div>
    </div>
  );
}

export default HotelsPage;
