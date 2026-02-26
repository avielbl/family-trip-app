import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plane, Clock, MapPin, Terminal, Hash, FileText, ExternalLink, Plus, Pencil, Trash2, Sparkles } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTripContext } from '../context/TripContext';
import { saveFlight, deleteFlight } from '../firebase/tripService';
import type { Flight } from '../types/trip';
import AIImportModal from '../components/AIImportModal';

function emptyFlight(): Flight {
  return {
    id: `flight-${Date.now()}`,
    dayIndex: 0,
    airline: '',
    flightNumber: '',
    departureAirport: '',
    departureAirportCode: '',
    arrivalAirport: '',
    arrivalAirportCode: '',
    departureTime: '',
    arrivalTime: '',
  };
}

const FlightsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { flights, tripCode, isAdmin } = useTripContext();
  const [editItem, setEditItem] = useState<Flight | null>(null);
  const [showImport, setShowImport] = useState(false);
  const isHe = i18n.language === 'he';

  const sortedFlights = useMemo(() => {
    return [...flights].sort(
      (a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime()
    );
  }, [flights]);

  const formatTime = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'HH:mm');
    } catch {
      return dateStr;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'EEE, MMM d');
    } catch {
      return dateStr;
    }
  };

  async function handleSave(f: Flight) {
    if (!tripCode) return;
    await saveFlight(tripCode, f);
    setEditItem(null);
  }

  async function handleDelete(id: string) {
    if (!tripCode) return;
    if (!confirm(isHe ? 'למחוק טיסה זו?' : 'Delete this flight?')) return;
    await deleteFlight(tripCode, id);
  }

  async function handleImportFlights(items: Record<string, unknown>[]) {
    if (!tripCode) return;
    for (const item of items) {
      const flight: Flight = {
        id: `flight-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        dayIndex: Number(item.dayIndex ?? 0),
        airline: String(item.airline ?? ''),
        flightNumber: String(item.flightNumber ?? ''),
        departureAirport: String(item.departureAirport ?? ''),
        departureAirportCode: String(item.departureAirportCode ?? ''),
        arrivalAirport: String(item.arrivalAirport ?? ''),
        arrivalAirportCode: String(item.arrivalAirportCode ?? ''),
        departureTime: String(item.departureTime ?? ''),
        arrivalTime: String(item.arrivalTime ?? ''),
        terminal: item.terminal ? String(item.terminal) : undefined,
        gate: item.gate ? String(item.gate) : undefined,
        confirmationCode: item.confirmationCode ? String(item.confirmationCode) : undefined,
        notes: item.notes ? String(item.notes) : undefined,
      };
      await saveFlight(tripCode, flight);
    }
    setShowImport(false);
  }

  return (
    <div className="flights-page">
      <h1 className="page-title">{t('flights.title')}</h1>

      {isAdmin && (
        <div className="admin-add-bar">
          <button className="admin-icon-btn add" onClick={() => setEditItem(emptyFlight())}>
            <Plus size={14} /> {isHe ? 'הוסף טיסה' : 'Add Flight'}
          </button>
          <button className="admin-icon-btn ai-import-btn" onClick={() => setShowImport(true)}>
            <Sparkles size={14} /> {isHe ? 'ייבוא AI' : 'AI Import'}
          </button>
        </div>
      )}

      <div className="flights-list">
        {sortedFlights.map((flight) => (
          <div key={flight.id} className="flight-card">
            <div className="flight-card-header">
              <div className="airline-logo-placeholder">
                <Plane size={24} />
              </div>
              <div className="flight-header-info">
                <span className="flight-airline">{flight.airline}</span>
                <span className="flight-number">{flight.flightNumber}</span>
              </div>
              <div className="flight-date">
                {formatDate(flight.departureTime)}
              </div>
            </div>

            <div className="flight-route">
              <div className="flight-endpoint departure">
                <span className="airport-code">{flight.departureAirportCode}</span>
                <span className="airport-name">{flight.departureAirport}</span>
                <div className="flight-time">
                  <Clock size={14} />
                  <span>{formatTime(flight.departureTime)}</span>
                </div>
              </div>

              <div className="flight-route-line">
                <div className="route-line" />
                <Plane size={16} className="route-plane-icon" />
                <div className="route-line" />
              </div>

              <div className="flight-endpoint arrival">
                <span className="airport-code">{flight.arrivalAirportCode}</span>
                <span className="airport-name">{flight.arrivalAirport}</span>
                <div className="flight-time">
                  <Clock size={14} />
                  <span>{formatTime(flight.arrivalTime)}</span>
                </div>
              </div>
            </div>

            <div className="flight-details">
              {flight.terminal && (
                <div className="flight-detail-item">
                  <Terminal size={14} />
                  <span className="detail-label">{t('flights.terminal')}:</span>
                  <span className="detail-value">{flight.terminal}</span>
                </div>
              )}

              {flight.gate && (
                <div className="flight-detail-item">
                  <MapPin size={14} />
                  <span className="detail-label">{t('flights.gate')}:</span>
                  <span className="detail-value">{flight.gate}</span>
                </div>
              )}

              {flight.confirmationCode && (
                <div className="flight-detail-item">
                  <Hash size={14} />
                  <span className="detail-label">{t('flights.confirmation')}:</span>
                  <span className="detail-value confirmation-code">
                    {flight.confirmationCode}
                  </span>
                </div>
              )}

              {flight.notes && (
                <div className="flight-detail-item">
                  <FileText size={14} />
                  <span className="detail-value flight-notes">{flight.notes}</span>
                </div>
              )}
            </div>

            {flight.boardingPassUrl && (
              <a
                href={flight.boardingPassUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="boarding-pass-link"
              >
                <ExternalLink size={14} />
                <span>{t('flights.boardingPass')}</span>
              </a>
            )}

            {isAdmin && (
              <div className="admin-controls">
                <button className="admin-icon-btn edit" onClick={() => setEditItem(flight)}>
                  <Pencil size={13} /> {t('common.edit')}
                </button>
                <button className="admin-icon-btn delete" onClick={() => handleDelete(flight.id)}>
                  <Trash2 size={13} /> {t('common.delete')}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editItem && (
        <FlightModal
          flight={editItem}
          isHe={isHe}
          onSave={handleSave}
          onClose={() => setEditItem(null)}
          t={t}
        />
      )}

      {showImport && (
        <AIImportModal
          target="flight"
          onAccept={handleImportFlights}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
};

function FlightModal({ flight, isHe, onSave, onClose, t }: {
  flight: Flight; isHe: boolean;
  onSave: (f: Flight) => void; onClose: () => void;
  t: (k: string) => string;
}) {
  const [form, setForm] = useState({ ...flight });
  function set(field: keyof Flight, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{isHe ? (flight.airline ? 'ערוך טיסה' : 'הוסף טיסה') : (flight.airline ? 'Edit Flight' : 'Add Flight')}</div>
        {([
          ['airline', isHe ? 'חברת תעופה' : 'Airline'],
          ['flightNumber', isHe ? 'מספר טיסה' : 'Flight Number'],
          ['departureAirport', isHe ? 'שדה תעופה יציאה' : 'Departure Airport'],
          ['departureAirportCode', isHe ? 'קוד יציאה' : 'Dep. Code'],
          ['arrivalAirport', isHe ? 'שדה תעופה הגעה' : 'Arrival Airport'],
          ['arrivalAirportCode', isHe ? 'קוד הגעה' : 'Arr. Code'],
          ['departureTime', isHe ? 'זמן יציאה (ISO)' : 'Departure Time (ISO)'],
          ['arrivalTime', isHe ? 'זמן הגעה (ISO)' : 'Arrival Time (ISO)'],
          ['terminal', isHe ? 'טרמינל' : 'Terminal'],
          ['gate', isHe ? 'שער' : 'Gate'],
          ['confirmationCode', isHe ? 'קוד אישור' : 'Confirmation Code'],
        ] as [keyof Flight, string][]).map(([field, label]) => (
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

export default FlightsPage;
