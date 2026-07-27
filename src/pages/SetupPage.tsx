import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Loader, Plus, LogIn, Trash2 } from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import { useFamilyContext } from '../context/FamilyContext';
import { saveTripDays } from '../firebase/tripService';
import BookingImport from '../components/BookingImport';
import type { TripConfig, TripDay, FamilyMember } from '../types/trip';

type WizardMode = 'choice' | 'join' | 'create' | 'members' | 'upload';

const DEFAULT_MEMBERS: Partial<FamilyMember>[] = [
  { name: '', nameHe: '', emoji: '👨', deviceType: 'phone' },
  { name: '', nameHe: '', emoji: '👩', deviceType: 'phone' },
  { name: '', nameHe: '', emoji: '🧒', deviceType: 'phone' },
  { name: '', nameHe: '', emoji: '🧒', deviceType: 'phone' },
  { name: '', nameHe: '', emoji: '👶', deviceType: 'tablet' },
];

const MS_PER_DAY = 86400000;

function buildDayStubs(startDate: string, endDate: string, location: string): TripDay[] {
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  const dayCount = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;

  const days: TripDay[] = [];
  for (let i = 0; i < dayCount; i++) {
    const date = new Date(start.getTime() + i * MS_PER_DAY);
    days.push({
      dayIndex: i,
      date: date.toISOString().slice(0, 10),
      title: `Day ${i + 1}`,
      titleHe: `יום ${i + 1}`,
      location,
      flights: [],
      hotels: [],
      driving: [],
      highlights: [],
      restaurants: [],
    });
  }
  return days;
}

export default function SetupPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { setTripCode, tripCode, browseTrip } = useTripContext();
  const { family, familyId, registerTrip } = useFamilyContext();

  const isHe = i18n.language === 'he';
  // In-app usage (integrator routes /trips/new here): skip the first-run
  // choice screen and start straight at trip details.
  const inApp = location.pathname === '/trips/new';

  const [mode, setMode] = useState<WizardMode>(inApp ? 'create' : 'choice');

  // Join step
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  // Create step (trip details)
  const [newTripCode, setNewTripCode] = useState('');
  const [tripName, setTripName] = useState('');
  const [destination, setDestination] = useState('');
  const [destinationHe, setDestinationHe] = useState('');
  const [flagEmoji, setFlagEmoji] = useState('✈️');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Members step — prefill from the family's member templates when available.
  const [members, setMembers] = useState<Partial<FamilyMember>[]>(() =>
    family?.memberTemplates?.length
      ? family.memberTemplates.map((m) => ({ ...m }))
      : DEFAULT_MEMBERS.map((m) => ({ ...m }))
  );
  // Default checked on first-run / when the family has no active trip.
  const [makeActive, setMakeActive] = useState(() => !family?.activeTripCode);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdCode, setCreatedCode] = useState('');

  const dateOrderValid = !startDate || !endDate || endDate >= startDate;
  const detailsValid =
    newTripCode.trim().length > 0 && !!startDate && !!endDate && endDate >= startDate;

  async function handleJoin() {
    setJoinError('');
    const success = await setTripCode(joinCode.trim().toLowerCase());
    if (success) {
      navigate('/');
    } else {
      setJoinError(isHe ? 'קוד טיול לא נמצא' : 'Trip code not found');
    }
  }

  async function handleCreateTrip() {
    if (!detailsValid) return;
    setCreating(true);
    setCreateError('');
    try {
      const code = newTripCode.trim().toLowerCase();
      const config: TripConfig = {
        tripCode: code,
        tripName,
        destination,
        destinationHe,
        flagEmoji,
        startDate,
        endDate,
        familyMembers: members.map((m, i) => ({
          id: `member-${i}`,
          name: m.name || `Member ${i + 1}`,
          nameHe: m.nameHe || m.name || `בן משפחה ${i + 1}`,
          emoji: m.emoji || '👤',
          deviceType: m.deviceType || 'phone',
        })),
        ...(familyId ? { familyId } : {}),
        status: 'upcoming',
        createdAt: new Date().toISOString(),
      };

      await registerTrip(config, makeActive);
      await saveTripDays(code, buildDayStubs(startDate, endDate, destination));

      if (!tripCode) {
        // First-run: no current trip on this device yet.
        await setTripCode(code);
      } else {
        browseTrip(code);
      }

      setCreatedCode(code);
      setMode('upload');
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  // Choice screen (first-run only)
  if (mode === 'choice') {
    return (
      <div className="setup-page">
        <div className="setup-hero">
          <div className="setup-emoji">✈️</div>
          <h1>{t('app.title')}</h1>
          <p>{t('app.subtitle')}</p>
        </div>

        <div className="setup-choices">
          <button className="setup-choice-btn primary" onClick={() => setMode('create')}>
            <Plus size={24} />
            <span>{t('setup.createTrip')}</span>
          </button>
          <div className="setup-or">{t('setup.or')}</div>
          <button className="setup-choice-btn" onClick={() => setMode('join')}>
            <LogIn size={24} />
            <span>{t('setup.join')}</span>
          </button>
        </div>
      </div>
    );
  }

  // Join screen (reachable only from the first-run choice screen)
  if (mode === 'join') {
    return (
      <div className="setup-page">
        <h2>{t('setup.join')}</h2>
        <div className="setup-form">
          <input
            type="text"
            className="setup-input"
            placeholder={t('setup.enterCode')}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          />
          {joinError && <p className="setup-error"><AlertCircle size={16} /> {joinError}</p>}
          <button className="setup-btn primary" onClick={handleJoin}>
            {t('setup.join')}
          </button>
          <button className="setup-btn secondary" onClick={() => setMode('choice')}>
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  // Step 1: trip details
  if (mode === 'create') {
    return (
      <div className="setup-page">
        <h2>{t('setup.createTrip')}</h2>
        <div className="setup-form">
          <label className="setup-label">
            {t('settings.tripCode')}
            <input
              type="text"
              className="setup-input"
              placeholder="e.g., italy2027"
              value={newTripCode}
              onChange={(e) => setNewTripCode(e.target.value)}
            />
          </label>

          <label className="setup-label">
            {isHe ? 'שם הטיול' : 'Trip Name'}
            <input
              type="text"
              className="setup-input"
              placeholder={isHe ? 'למשל: איטליה 2027' : 'e.g., Italy 2027'}
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
            />
          </label>

          <label className="setup-label">
            {isHe ? 'יעד (אנגלית)' : 'Destination (English)'}
            <input
              type="text"
              className="setup-input"
              placeholder="e.g., Italy"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </label>

          <label className="setup-label">
            {isHe ? 'יעד (עברית)' : 'Destination (Hebrew)'}
            <input
              type="text"
              className="setup-input"
              dir="rtl"
              placeholder="למשל: איטליה"
              value={destinationHe}
              onChange={(e) => setDestinationHe(e.target.value)}
            />
          </label>

          <label className="setup-label">
            {isHe ? 'אימוג׳י דגל' : 'Flag Emoji'}
            <input
              type="text"
              className="setup-input"
              value={flagEmoji}
              onChange={(e) => setFlagEmoji(e.target.value)}
              style={{ width: '80px' }}
            />
          </label>

          <label className="setup-label">
            {isHe ? 'תאריך התחלה' : 'Start Date'}
            <input
              type="date"
              className="setup-input"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>

          <label className="setup-label">
            {isHe ? 'תאריך סיום' : 'End Date'}
            <input
              type="date"
              className="setup-input"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>

          {!dateOrderValid && (
            <p className="setup-error">
              <AlertCircle size={16} />{' '}
              {isHe
                ? 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה'
                : 'End date must be on or after the start date'}
            </p>
          )}

          <button
            className="setup-btn primary"
            onClick={() => setMode('members')}
            disabled={!detailsValid}
          >
            {isHe ? 'הבא' : 'Next'}
          </button>
          <button
            className="setup-btn secondary"
            onClick={() => (inApp ? navigate('/') : setMode('choice'))}
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  // Step 2: family members
  if (mode === 'members') {
    return (
      <div className="setup-page">
        <h2>{isHe ? 'בני המשפחה' : 'Family Members'}</h2>
        <div className="setup-form">
          {members.map((m, i) => (
            <div key={i} className="member-row">
              <input
                className="setup-input small"
                placeholder="Emoji"
                value={m.emoji}
                onChange={(e) => {
                  const updated = [...members];
                  updated[i] = { ...updated[i], emoji: e.target.value };
                  setMembers(updated);
                }}
                style={{ width: '60px' }}
              />
              <input
                className="setup-input"
                placeholder="Name (English)"
                value={m.name}
                onChange={(e) => {
                  const updated = [...members];
                  updated[i] = { ...updated[i], name: e.target.value };
                  setMembers(updated);
                }}
              />
              <input
                className="setup-input"
                placeholder="שם (עברית)"
                dir="rtl"
                value={m.nameHe}
                onChange={(e) => {
                  const updated = [...members];
                  updated[i] = { ...updated[i], nameHe: e.target.value };
                  setMembers(updated);
                }}
              />
              <select
                className="setup-input small"
                value={m.deviceType}
                onChange={(e) => {
                  const updated = [...members];
                  updated[i] = { ...updated[i], deviceType: e.target.value as 'phone' | 'tablet' };
                  setMembers(updated);
                }}
              >
                <option value="phone">📱</option>
                <option value="tablet">📱 Tablet</option>
              </select>
              <button
                className="setup-btn text"
                onClick={() => setMembers(members.filter((_, idx) => idx !== i))}
                aria-label={isHe ? 'הסר בן משפחה' : 'Remove member'}
                style={{ padding: '4px' }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            className="setup-btn text"
            onClick={() =>
              setMembers([...members, { name: '', nameHe: '', emoji: '👤', deviceType: 'phone' }])
            }
          >
            <Plus size={16} /> {isHe ? 'הוסף בן משפחה' : 'Add Member'}
          </button>

          <label
            className="setup-label"
            style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}
          >
            <input
              type="checkbox"
              checked={makeActive}
              onChange={(e) => setMakeActive(e.target.checked)}
            />
            {isHe ? 'הפוך לטיול הפעיל של המשפחה' : "Set as the family's active trip"}
          </label>

          {createError && (
            <p className="setup-error">
              <AlertCircle size={16} /> {createError}
            </p>
          )}

          <button
            className="setup-btn primary"
            onClick={handleCreateTrip}
            disabled={creating || !detailsValid}
          >
            {creating ? <Loader size={16} className="spin" /> : null}
            {t('setup.createTrip')}
          </button>
          <button className="setup-btn secondary" onClick={() => setMode('create')}>
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  // Step 3: import bookings into the freshly created trip
  if (mode === 'upload') {
    return (
      <div className="setup-page">
        <h2>{t('setup.uploadTitle')}</h2>
        <p className="setup-description">{t('setup.uploadDescription')}</p>
        <BookingImport
          tripCode={createdCode}
          startDate={startDate}
          endDate={endDate}
          onDone={() => navigate('/')}
        />
      </div>
    );
  }

  return null;
}
