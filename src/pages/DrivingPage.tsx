import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Car, Navigation, Clock, MapPin, ExternalLink, Plus, Pencil, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTripContext } from '../context/TripContext';
import { saveDrivingSegment, deleteDrivingSegment, saveRentalCar, deleteRentalCar } from '../firebase/tripService';
import type { DrivingSegment, RentalCar } from '../types/trip';

function emptySegment(dayIndex = 0): DrivingSegment {
  return { id: `seg-${Date.now()}`, dayIndex, from: '', to: '' };
}

function emptyCar(): RentalCar {
  return {
    id: `car-${Date.now()}`,
    company: '',
    pickupLocation: '',
    pickupTime: '',
    returnLocation: '',
    returnTime: '',
  };
}

const DrivingPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { driving, rentalCars, days, tripCode, isAdmin } = useTripContext();
  const [editSeg, setEditSeg] = useState<DrivingSegment | null>(null);
  const [editCar, setEditCar] = useState<RentalCar | null>(null);
  const isHe = i18n.language === 'he';

  const formatDateTime = (dateStr: string) => {
    try { return format(parseISO(dateStr), 'EEE, MMM d, yyyy HH:mm'); }
    catch { return dateStr; }
  };

  const getMapUrl = (segment: DrivingSegment) => {
    if (segment.mapUrl) return segment.mapUrl;
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(segment.from)}&destination=${encodeURIComponent(segment.to)}&travelmode=driving`;
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
      try { return `${t('common.day')} ${dayIndex + 1} - ${format(parseISO(day.date), 'MMM d')}`; }
      catch { return `${t('common.day')} ${dayIndex + 1}`; }
    }
    return `${t('common.day')} ${dayIndex + 1}`;
  };

  async function handleSaveSeg(s: DrivingSegment) {
    if (!tripCode) return;
    await saveDrivingSegment(tripCode, s);
    setEditSeg(null);
  }

  async function handleDeleteSeg(id: string) {
    if (!tripCode) return;
    if (!confirm(isHe ? 'למחוק מסלול זה?' : 'Delete this segment?')) return;
    await deleteDrivingSegment(tripCode, id);
  }

  async function handleSaveCar(c: RentalCar) {
    if (!tripCode) return;
    await saveRentalCar(tripCode, c);
    setEditCar(null);
  }

  async function handleDeleteCar(id: string) {
    if (!tripCode) return;
    if (!confirm(isHe ? 'למחוק רכב זה?' : 'Delete this rental car?')) return;
    await deleteRentalCar(tripCode, id);
  }

  return (
    <div className="driving-page">
      <h1 className="page-title">{t('driving.title')}</h1>

      {/* Rental Cars */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h2 className="section-title" style={{ margin: 0 }}>{t('driving.rentalCar')}</h2>
        {isAdmin && (
          <button className="admin-icon-btn add" onClick={() => setEditCar(emptyCar())}>
            <Plus size={14} /> {isHe ? 'הוסף רכב' : 'Add Car'}
          </button>
        )}
      </div>

      {rentalCars.map((car: RentalCar) => (
        <div key={car.id} className="rental-card card">
          <div className="card-header">
            <Car size={20} />
            <div>
              <div className="card-title">{car.company}</div>
              {car.carType && <div className="card-subtitle">{car.carType}</div>}
            </div>
          </div>

          {car.confirmationCode && (
            <div className="card-detail">{t('flights.confirmation')}: <strong>{car.confirmationCode}</strong></div>
          )}
          <div className="card-detail"><MapPin size={13} /> {t('driving.pickup')}: {car.pickupLocation} · {formatDateTime(car.pickupTime)}</div>
          <div className="card-detail"><MapPin size={13} /> {t('driving.return')}: {car.returnLocation} · {formatDateTime(car.returnTime)}</div>
          {car.phone && <div className="card-detail">{t('hotels.phone')}: <a href={`tel:${car.phone}`}>{car.phone}</a></div>}
          {car.notes && <div className="card-detail">{car.notes}</div>}

          {isAdmin && (
            <div className="admin-controls">
              <button className="admin-icon-btn edit" onClick={() => setEditCar(car)}>
                <Pencil size={13} /> {t('common.edit')}
              </button>
              <button className="admin-icon-btn delete" onClick={() => handleDeleteCar(car.id)}>
                <Trash2 size={13} /> {t('common.delete')}
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Driving Segments */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', marginTop: '16px' }}>
        <h2 className="section-title" style={{ margin: 0 }}>{isHe ? 'מסלולי נסיעה' : 'Driving Segments'}</h2>
        {isAdmin && (
          <button className="admin-icon-btn add" onClick={() => setEditSeg(emptySegment())}>
            <Plus size={14} /> {isHe ? 'הוסף מסלול' : 'Add Segment'}
          </button>
        )}
      </div>

      {Array.from(segmentsByDay.entries()).map(([dayIndex, segments]) => (
        <div key={dayIndex} className="driving-day-group">
          <h3 className="day-header">{getDayLabel(dayIndex)}</h3>

          {segments.map((segment) => (
            <div key={segment.id} className="driving-segment">
              <div className="segment-route">
                <Navigation size={16} />
                <strong>{segment.from}</strong>
                <span style={{ margin: '0 4px' }}>→</span>
                <strong>{segment.to}</strong>
              </div>
              <div style={{ display: 'flex', gap: '12px', margin: '6px 0', flexWrap: 'wrap' }}>
                {segment.distanceKm != null && (
                  <div className="card-detail"><Car size={13} /> {t('driving.distance', { km: segment.distanceKm })}</div>
                )}
                {segment.durationMinutes != null && (
                  <div className="card-detail"><Clock size={13} /> {t('driving.duration', { minutes: segment.durationMinutes })}</div>
                )}
              </div>
              {segment.notes && <div className="card-detail">{segment.notes}</div>}

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                <a href={getMapUrl(segment)} target="_blank" rel="noopener noreferrer" className="open-map-btn">
                  <MapPin size={14} /> {t('driving.openMap')} <ExternalLink size={12} />
                </a>
                {isAdmin && (
                  <>
                    <button className="admin-icon-btn edit" onClick={() => setEditSeg(segment)}>
                      <Pencil size={13} /> {t('common.edit')}
                    </button>
                    <button className="admin-icon-btn delete" onClick={() => handleDeleteSeg(segment.id)}>
                      <Trash2 size={13} /> {t('common.delete')}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Modals */}
      {editSeg && (
        <SimpleModal
          title={isHe ? 'מסלול נסיעה' : 'Driving Segment'}
          fields={[
            { key: 'from', label: isHe ? 'מ-' : 'From' },
            { key: 'to', label: isHe ? 'אל' : 'To' },
            { key: 'distanceKm', label: isHe ? 'מרחק (ק"מ)' : 'Distance (km)' },
            { key: 'durationMinutes', label: isHe ? 'משך (דקות)' : 'Duration (min)' },
            { key: 'notes', label: isHe ? 'הערות' : 'Notes' },
          ]}
          data={editSeg as any}
          onSave={(d) => handleSaveSeg(d as DrivingSegment)}
          onClose={() => setEditSeg(null)}
          t={t}
        />
      )}
      {editCar && (
        <SimpleModal
          title={isHe ? 'רכב שכור' : 'Rental Car'}
          fields={[
            { key: 'company', label: isHe ? 'חברה' : 'Company' },
            { key: 'carType', label: isHe ? 'סוג רכב' : 'Car Type' },
            { key: 'confirmationCode', label: isHe ? 'קוד אישור' : 'Confirmation Code' },
            { key: 'pickupLocation', label: isHe ? 'מקום איסוף' : 'Pickup Location' },
            { key: 'pickupTime', label: isHe ? 'זמן איסוף (ISO)' : 'Pickup Time (ISO)' },
            { key: 'returnLocation', label: isHe ? 'מקום החזרה' : 'Return Location' },
            { key: 'returnTime', label: isHe ? 'זמן החזרה (ISO)' : 'Return Time (ISO)' },
            { key: 'phone', label: isHe ? 'טלפון' : 'Phone' },
            { key: 'notes', label: isHe ? 'הערות' : 'Notes' },
          ]}
          data={editCar as any}
          onSave={(d) => handleSaveCar(d as RentalCar)}
          onClose={() => setEditCar(null)}
          t={t}
        />
      )}
    </div>
  );
};

function SimpleModal({ title, fields, data, onSave, onClose, t }: {
  title: string;
  fields: { key: string; label: string }[];
  data: Record<string, any>;
  onSave: (d: Record<string, any>) => void;
  onClose: () => void;
  t: (k: string) => string;
}) {
  const [form, setForm] = useState({ ...data });
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        {fields.map(({ key, label }) => (
          <div className="form-group" key={key}>
            <label className="form-label">{label}</label>
            <input className="form-input" value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
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

export default DrivingPage;
