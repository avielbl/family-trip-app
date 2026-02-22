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
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTripContext } from '../context/TripContext';

const HotelsPage: React.FC = () => {
  const { t } = useTranslation();
  const { hotels } = useTripContext();
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  return (
    <div className="hotels-page">
      <h1>{t('hotels.title')}</h1>

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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HotelsPage;
