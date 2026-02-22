import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Car, Navigation, Clock, MapPin, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTripContext } from '../context/TripContext';
import type { DrivingSegment, RentalCar } from '../types/trip';

const DrivingPage: React.FC = () => {
  const { t } = useTranslation();
  const { driving, rentalCars, days } = useTripContext();

  const formatDateTime = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'EEE, MMM d, yyyy HH:mm');
    } catch {
      return dateStr;
    }
  };

  const getMapUrl = (segment: DrivingSegment) => {
    if (segment.mapUrl) return segment.mapUrl;
    const origin = encodeURIComponent(segment.from);
    const destination = encodeURIComponent(segment.to);
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  };

  const segmentsByDay = useMemo(() => {
    const grouped = new Map<number, DrivingSegment[]>();
    const sorted = [...driving].sort((a, b) => a.dayIndex - b.dayIndex);
    for (const segment of sorted) {
      const existing = grouped.get(segment.dayIndex) || [];
      existing.push(segment);
      grouped.set(segment.dayIndex, existing);
    }
    return grouped;
  }, [driving]);

  const getDayLabel = (dayIndex: number) => {
    const day = days.find((d) => d.dayIndex === dayIndex);
    if (day) {
      try {
        const dateStr = format(parseISO(day.date), 'MMM d');
        return `${t('common.day')} ${dayIndex + 1} - ${dateStr}`;
      } catch {
        return `${t('common.day')} ${dayIndex + 1}`;
      }
    }
    return `${t('common.day')} ${dayIndex + 1}`;
  };

  return (
    <div className="driving-page">
      <h1>{t('driving.title')}</h1>

      {rentalCars.map((car: RentalCar) => (
        <div key={car.id} className="rental-card">
          <div className="rental-card-header">
            <Car size={20} />
            <h2>{t('driving.rentalCar')}</h2>
          </div>

          <div className="rental-details">
            <div className="rental-company">
              <strong>{car.company}</strong>
              {car.carType && <span className="car-type"> &middot; {car.carType}</span>}
            </div>

            {car.confirmationCode && (
              <div className="rental-detail-item">
                <span className="detail-label">{t('flights.confirmation')}:</span>
                <span className="detail-value confirmation-code">{car.confirmationCode}</span>
              </div>
            )}

            <div className="rental-detail-item">
              <MapPin size={14} />
              <span className="detail-label">{t('driving.pickup')}:</span>
              <span className="detail-value">
                {car.pickupLocation} &middot; {formatDateTime(car.pickupTime)}
              </span>
            </div>

            <div className="rental-detail-item">
              <MapPin size={14} />
              <span className="detail-label">{t('driving.return')}:</span>
              <span className="detail-value">
                {car.returnLocation} &middot; {formatDateTime(car.returnTime)}
              </span>
            </div>

            {car.phone && (
              <div className="rental-detail-item">
                <span className="detail-label">{t('hotels.phone')}:</span>
                <a href={`tel:${car.phone}`} className="detail-value phone-link">
                  {car.phone}
                </a>
              </div>
            )}

            {car.notes && (
              <div className="rental-detail-item">
                <span className="detail-label">{t('common.notes')}:</span>
                <span className="detail-value">{car.notes}</span>
              </div>
            )}
          </div>
        </div>
      ))}

      {Array.from(segmentsByDay.entries()).map(([dayIndex, segments]) => (
        <div key={dayIndex} className="driving-day-group">
          <h3>{getDayLabel(dayIndex)}</h3>

          {segments.map((segment) => (
            <div key={segment.id} className="driving-segment">
              <div className="segment-route">
                <Navigation size={16} />
                <span className="route-from">{segment.from}</span>
                <span className="route-arrow">&rarr;</span>
                <span className="route-to">{segment.to}</span>
              </div>

              <div className="segment-details">
                {segment.distanceKm != null && (
                  <div className="segment-detail">
                    <Car size={14} />
                    <span>{t('driving.distance', { km: segment.distanceKm })}</span>
                  </div>
                )}

                {segment.durationMinutes != null && (
                  <div className="segment-detail">
                    <Clock size={14} />
                    <span>{t('driving.duration', { minutes: segment.durationMinutes })}</span>
                  </div>
                )}
              </div>

              {segment.notes && (
                <div className="segment-notes">
                  <span className="detail-label">{t('common.notes')}:</span>
                  <span>{segment.notes}</span>
                </div>
              )}

              <a
                href={getMapUrl(segment)}
                target="_blank"
                rel="noopener noreferrer"
                className="open-map-btn"
              >
                <MapPin size={16} />
                <span>{t('driving.openMap')}</span>
                <ExternalLink size={14} />
              </a>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default DrivingPage;
