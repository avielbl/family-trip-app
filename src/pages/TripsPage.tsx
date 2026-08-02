import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Luggage, Plus, Users, Loader, Star, Archive } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useFamilyContext } from '../context/FamilyContext';
import { useTripContext } from '../context/TripContext';
import type { TripSummary } from '../types/trip';

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

interface BadgeInfo {
  label: string;
  background: string;
  color: string;
}

function getBadge(trip: TripSummary, activeTripCode: string | null | undefined, isHe: boolean): BadgeInfo {
  if (activeTripCode === trip.tripCode) {
    return {
      label: isHe ? 'פעיל ✈️' : 'Active ✈️',
      background: '#dcfce7',
      color: '#166534',
    };
  }
  if (trip.status === 'archived') {
    return {
      label: isHe ? 'עבר' : 'Past',
      background: '#e5e7eb',
      color: '#4b5563',
    };
  }
  let ended = false;
  try {
    ended = parseISO(trip.endDate).getTime() < Date.now();
  } catch {
    ended = false;
  }
  if (ended) {
    return {
      label: isHe ? 'הסתיים' : 'Ended',
      background: '#fef3c7',
      color: '#92400e',
    };
  }
  return {
    label: isHe ? 'בקרוב' : 'Upcoming',
    background: '#dbeafe',
    color: '#1d4ed8',
  };
}

export default function TripsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isHe = i18n.language === 'he';

  const {
    family,
    familyLoading,
    trips,
    isFamilyAdmin,
    setActiveTrip,
    archiveTrip,
  } = useFamilyContext();
  const { tripCode: viewingTripCode, browseTrip } = useTripContext();

  const activeTripCode = family?.activeTripCode ?? null;

  const sortedTrips = useMemo(() => {
    return [...trips].sort((a, b) => {
      if (a.tripCode === activeTripCode && b.tripCode !== activeTripCode) return -1;
      if (b.tripCode === activeTripCode && a.tripCode !== activeTripCode) return 1;
      return (b.startDate ?? '').localeCompare(a.startDate ?? '');
    });
  }, [trips, activeTripCode]);

  const handleOpenTrip = (code: string) => {
    browseTrip(code);
    navigate('/');
  };

  const handleSetActive = async (code: string) => {
    try {
      await setActiveTrip(code);
    } catch (err) {
      console.error('Failed to set active trip:', err);
    }
  };

  const handleArchive = async (code: string) => {
    if (!confirm(isHe ? 'להעביר את הטיול לארכיון?' : 'Archive this trip?')) return;
    try {
      await archiveTrip(code);
    } catch (err) {
      console.error('Failed to archive trip:', err);
    }
  };

  if (familyLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '48px 16px' }}>
        <Loader size={40} className="spin" />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  const newTripButton = (
    <button className="setup-btn primary" onClick={() => navigate('/trips/new')}>
      <Plus size={16} style={{ verticalAlign: 'middle', marginInlineEnd: '4px' }} />
      {isHe ? 'טיול חדש' : 'New Trip'}
    </button>
  );

  return (
    <div className="trips-page">
      <h1
        className="page-title"
        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <Luggage size={24} />
        {isHe ? 'הטיולים שלנו' : 'Our Trips'}
      </h1>

      {isFamilyAdmin && trips.length > 0 && (
        <div style={{ marginBottom: '16px' }}>{newTripButton}</div>
      )}

      {trips.length === 0 ? (
        <div
          className="card"
          style={{ textAlign: 'center', padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}
        >
          <span style={{ fontSize: '40px' }}>🧳</span>
          <p style={{ margin: 0 }}>
            {isHe
              ? 'עדיין אין טיולים. זה הזמן לתכנן את ההרפתקה הבאה!'
              : 'No trips yet. Time to plan your next adventure!'}
          </p>
          {isFamilyAdmin && newTripButton}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sortedTrips.map((trip) => {
            const badge = getBadge(trip, activeTripCode, isHe);
            const isViewing = trip.tripCode === viewingTripCode;
            const destination = isHe
              ? trip.destinationHe ?? trip.destination
              : trip.destination;

            return (
              <div
                key={trip.tripCode}
                className="card"
                onClick={() => handleOpenTrip(trip.tripCode)}
                style={{
                  cursor: 'pointer',
                  ...(isViewing ? { outline: '2px solid var(--blue-500)' } : {}),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <span style={{ fontSize: '36px', lineHeight: 1 }}>
                    {trip.flagEmoji ?? '✈️'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '16px' }}>{trip.tripName}</strong>
                      <span
                        style={{
                          background: badge.background,
                          color: badge.color,
                          borderRadius: '999px',
                          padding: '2px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {badge.label}
                      </span>
                      {isViewing && (
                        <span
                          style={{
                            color: 'var(--blue-500)',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          {isHe ? 'צופים' : 'Viewing'}
                        </span>
                      )}
                    </div>
                    {destination && (
                      <div style={{ fontSize: '14px', opacity: 0.8, marginTop: '2px' }}>
                        {destination}
                      </div>
                    )}
                    <div style={{ fontSize: '13px', opacity: 0.7, marginTop: '4px' }}>
                      {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        opacity: 0.7,
                        marginTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Users size={14} />
                      <span>{trip.memberCount}</span>
                    </div>
                  </div>
                </div>

                {isFamilyAdmin && (
                  <div
                    style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {activeTripCode !== trip.tripCode && (
                      <button
                        className="admin-icon-btn edit"
                        onClick={() => void handleSetActive(trip.tripCode)}
                      >
                        <Star size={14} />
                        {isHe ? 'הפוך לטיול הפעיל' : 'Set as family trip'}
                      </button>
                    )}
                    {trip.status !== 'archived' && (
                      <button
                        className="admin-icon-btn delete"
                        onClick={() => void handleArchive(trip.tripCode)}
                      >
                        <Archive size={14} />
                        {isHe ? 'העבר לארכיון' : 'Archive'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
