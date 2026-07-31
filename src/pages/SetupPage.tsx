import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Loader, Plus, LogIn, Trash2 } from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import { useFamilyContext } from '../context/FamilyContext';
import { useAuthContext } from '../context/AuthContext';
import { saveTripDays } from '../firebase/tripService';
import { updateMemberTemplates } from '../firebase/familyService';
import BookingImport from '../components/BookingImport';
import type { TripConfig, TripDay, FamilyMember } from '../types/trip';

type WizardMode = 'choice' | 'join' | 'create' | 'members' | 'upload';

// A roster row: the family-level member plus whether they join THIS trip.
interface RosterRow {
  member: FamilyMember;
  included: boolean;
  isNew: boolean; // added in this wizard session (not yet in the family roster)
}

function makeDefaultRoster(): RosterRow[] {
  const defaults: Array<Pick<FamilyMember, 'emoji' | 'deviceType'>> = [
    { emoji: '👨', deviceType: 'phone' },
    { emoji: '👩', deviceType: 'phone' },
    { emoji: '🧒', deviceType: 'phone' },
    { emoji: '🧒', deviceType: 'phone' },
    { emoji: '👶', deviceType: 'tablet' },
  ];
  return defaults.map((d, i) => ({
    member: { id: `member-${i}`, name: '', nameHe: '', emoji: d.emoji, deviceType: d.deviceType },
    included: true,
    isNew: true,
  }));
}

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
  const { family, familyId, familyLoading, recoveryError, recoveryDiag, registerTrip } =
    useFamilyContext();
  const { firebaseUser, authLoading, authError, signInWithGoogle, signOutUser } = useAuthContext();

  const isHe = i18n.language === 'he';
  // In-app usage (integrator routes /trips/new here): skip the first-run
  // choice screen and start straight at trip details.
  const inApp = location.pathname === '/trips/new';

  const [mode, setMode] = useState<WizardMode>(inApp ? 'create' : 'choice');

  // Nothing to set up: a trip is already active (e.g. resolved after this
  // page mounted, or a stale /setup URL) — go to it.
  useEffect(() => {
    if (mode === 'choice' && tripCode) {
      navigate('/', { replace: true });
    }
  }, [mode, tripCode, navigate]);

  // Join step
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  // Create step (trip details)
  const [newTripCode, setNewTripCode] = useState('');
  const [tripName, setTripName] = useState('');
  const [destination, setDestination] = useState('');
  const [destinationHe, setDestinationHe] = useState('');
  const [flagEmoji, setFlagEmoji] = useState('✈️');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Members step — the family roster is the baseline. Each row can be edited
  // (edits sync back to the family collection) and toggled for THIS trip.
  const [roster, setRoster] = useState<RosterRow[]>(() =>
    family?.memberTemplates?.length
      ? family.memberTemplates.map((m) => ({ member: { ...m }, included: true, isNew: false }))
      : makeDefaultRoster()
  );

  // The family doc can finish loading after mount (e.g. direct navigation to
  // /trips/new). Refresh the roster from the templates as long as the user
  // hasn't reached the members step yet.
  const rosterSeeded = useRef(!!family?.memberTemplates?.length);
  useEffect(() => {
    if (rosterSeeded.current) return;
    if (mode === 'members' || mode === 'upload') return;
    if (family?.memberTemplates?.length) {
      setRoster(family.memberTemplates.map((m) => ({ member: { ...m }, included: true, isNew: false })));
      rosterSeeded.current = true;
    }
  }, [family, mode]);
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

      // Full family roster (with edits, defaults applied) — ids stay stable
      // across trips so scoreboards/photos/email matching remain consistent.
      const fullRoster: FamilyMember[] = roster.map(({ member }, i) => ({
        ...member,
        name: member.name || `Member ${i + 1}`,
        nameHe: member.nameHe || member.name || `בן משפחה ${i + 1}`,
        emoji: member.emoji || '👤',
        deviceType: member.deviceType || 'phone',
      }));
      const participants = fullRoster.filter((_, i) => roster[i].included);

      if (participants.length === 0) {
        setCreateError(isHe ? 'יש לבחור לפחות בן משפחה אחד לטיול' : 'Select at least one family member for this trip');
        setCreating(false);
        return;
      }

      const config: TripConfig = {
        tripCode: code,
        tripName,
        destination,
        destinationHe,
        flagEmoji,
        startDate,
        endDate,
        familyMembers: participants,
        ...(familyId ? { familyId } : {}),
        status: 'upcoming',
        createdAt: new Date().toISOString(),
      };

      await registerTrip(config, makeActive);

      // Sync edits (and newly added members) back to the family roster —
      // including members not participating in this trip. registerTrip may
      // have just created the family, so re-read the id from localStorage.
      const resolvedFamilyId = familyId ?? localStorage.getItem('familyId');
      if (resolvedFamilyId) {
        await updateMemberTemplates(resolvedFamilyId, fullRoster);
      }

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

  // Choice screen (first-run only). Sign-in comes first: an existing user
  // who cleared local data recovers their family and trips just by signing in.
  if (mode === 'choice') {
    if (authLoading || (firebaseUser && familyLoading)) {
      return (
        <div className="setup-page">
          <div className="setup-hero">
            <div className="setup-emoji">✈️</div>
            <h1>{t('app.title')}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-muted)' }}>
            <Loader size={20} className="spin" />
            <span>{isHe ? 'משחזר את הטיולים שלך...' : 'Restoring your trips...'}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="setup-page">
        <div className="setup-hero">
          <div className="setup-emoji">✈️</div>
          <h1>{t('app.title')}</h1>
          <p>{t('app.subtitle')}</p>
        </div>

        <div className="setup-choices">
          {!firebaseUser ? (
            <>
              <p className="setup-description" style={{ textAlign: 'center' }}>
                {isHe
                  ? 'כבר יש לכם טיולים? התחברו כדי לשחזר אותם'
                  : 'Already have trips? Sign in to restore them'}
              </p>
              <button
                className="google-signin-btn"
                disabled={signingIn}
                onClick={() => {
                  setSigningIn(true);
                  signInWithGoogle()
                    .catch(() => { /* surfaced via authError */ })
                    .finally(() => setSigningIn(false));
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
                </svg>
                {signingIn
                  ? (isHe ? 'מתחבר...' : 'Signing in...')
                  : (isHe ? 'התחבר עם Google' : 'Sign in with Google')}
              </button>
              {authError && (
                <p className="setup-error">
                  <AlertCircle size={16} />{' '}
                  {isHe ? `הכניסה נכשלה: ${authError}` : `Sign-in failed: ${authError}`}
                </p>
              )}
              <div className="setup-or">{t('setup.or')}</div>
            </>
          ) : (
            <>
              <p className="setup-description" style={{ textAlign: 'center' }}>
                {family
                  ? isHe
                    ? `מחובר/ת כ־${firebaseUser.email} — המשפחה נמצאה אך אין בה טיולים עדיין`
                    : `Signed in as ${firebaseUser.email} — family found, but it has no trips yet`
                  : isHe
                    ? `מחובר/ת כ־${firebaseUser.email} — לא נמצאה משפחה קיימת`
                    : `Signed in as ${firebaseUser.email} — no existing family found`}
              </p>
              {recoveryError && (
                <p className="setup-error" style={{ justifyContent: 'center' }}>
                  <AlertCircle size={16} />{' '}
                  {isHe ? `שגיאת שחזור: ${recoveryError}` : `Recovery error: ${recoveryError}`}
                </p>
              )}
              <p className="setup-build-stamp" style={{ marginTop: 0, direction: 'ltr' }}>
                {[
                  `local=${familyId ?? '-'}`,
                  `family=${family ? 'loaded' : '-'}`,
                  family ? `familyTrips=${family.tripCodes?.length ?? 0}` : null,
                  family ? `active=${family.activeTripCode ?? '-'}` : null,
                  recoveryDiag,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <button
                className="setup-btn secondary"
                onClick={() => signOutUser().catch(() => { /* ignore */ })}
              >
                {isHe ? 'התנתק ונסה חשבון אחר' : 'Sign out and try another account'}
              </button>
            </>
          )}

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

        <p className="setup-build-stamp">
          {import.meta.env.VITE_FIREBASE_PROJECT_ID || 'no-project'} ·{' '}
          {isHe ? 'גרסה' : 'Version'} {__APP_VERSION__} ·{' '}
          {new Intl.DateTimeFormat(isHe ? 'he-IL' : 'en-GB', {
            timeZone: 'Asia/Jerusalem',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(__BUILD_TIME__))}
        </p>
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

  // Step 2: family members — the family roster is the baseline. Uncheck a
  // member to leave them out of THIS trip; edits update the family itself.
  if (mode === 'members') {
    const updateRow = (i: number, patch: Partial<FamilyMember>) => {
      setRoster((rows) =>
        rows.map((row, idx) => (idx === i ? { ...row, member: { ...row.member, ...patch } } : row))
      );
    };

    return (
      <div className="setup-page">
        <h2>{isHe ? 'בני המשפחה' : 'Family Members'}</h2>
        <p className="setup-description">
          {isHe
            ? 'זו רשימת המשפחה הקבועה. עדכון פרטים ישמר למשפחה; הסרת סימון תשאיר את בן המשפחה מחוץ לטיול הזה בלבד.'
            : 'This is your family roster. Detail edits are saved to the family; unchecking leaves a member out of this trip only.'}
        </p>
        <div className="setup-form">
          {roster.map((row, i) => (
            <div
              key={row.member.id}
              className="member-row"
              style={{ opacity: row.included ? 1 : 0.45, flexWrap: 'wrap' }}
            >
              <input
                type="checkbox"
                checked={row.included}
                onChange={(e) =>
                  setRoster((rows) =>
                    rows.map((r, idx) => (idx === i ? { ...r, included: e.target.checked } : r))
                  )
                }
                title={isHe ? 'משתתפ/ת בטיול הזה' : 'Joining this trip'}
                style={{ width: '18px', height: '18px', flexShrink: 0 }}
              />
              <input
                className="setup-input small"
                placeholder="Emoji"
                value={row.member.emoji}
                onChange={(e) => updateRow(i, { emoji: e.target.value })}
                style={{ width: '54px' }}
              />
              <input
                className="setup-input"
                placeholder="Name (English)"
                value={row.member.name}
                onChange={(e) => updateRow(i, { name: e.target.value })}
              />
              <input
                className="setup-input"
                placeholder="שם (עברית)"
                dir="rtl"
                value={row.member.nameHe}
                onChange={(e) => updateRow(i, { nameHe: e.target.value })}
              />
              <input
                className="setup-input"
                type="email"
                placeholder="email@..."
                value={row.member.email ?? ''}
                onChange={(e) => updateRow(i, { email: e.target.value })}
              />
              <select
                className="setup-input small"
                value={row.member.deviceType}
                onChange={(e) => updateRow(i, { deviceType: e.target.value as 'phone' | 'tablet' })}
              >
                <option value="phone">📱</option>
                <option value="tablet">📱 Tablet</option>
              </select>
              {row.isNew && (
                <button
                  className="setup-btn text"
                  onClick={() => setRoster((rows) => rows.filter((_, idx) => idx !== i))}
                  aria-label={isHe ? 'הסר בן משפחה' : 'Remove member'}
                  style={{ padding: '4px' }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
          <button
            className="setup-btn text"
            onClick={() =>
              setRoster((rows) => [
                ...rows,
                {
                  member: {
                    id: `member-${Date.now()}`,
                    name: '',
                    nameHe: '',
                    emoji: '👤',
                    deviceType: 'phone',
                  },
                  included: true,
                  isNew: true,
                },
              ])
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
