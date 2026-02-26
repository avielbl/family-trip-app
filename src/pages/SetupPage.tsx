import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Upload, FileText, Check, Loader, AlertCircle, Plus, LogIn } from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import { useAuthContext } from '../context/AuthContext';
import { saveTripConfig, importTripData } from '../firebase/tripService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { TripConfig, FamilyMember } from '../types/trip';

export default function SetupPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setTripCode, tripCode } = useTripContext();
  const { firebaseUser, signInWithGoogle, authLoading } = useAuthContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'choice' | 'join' | 'create' | 'upload'>('choice');
  const [googleSigningIn, setGoogleSigningIn] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [newTripCode, setNewTripCode] = useState('');
  const [tripName, setTripName] = useState('Greece 2026');
  const [members, setMembers] = useState<Partial<FamilyMember>[]>([
    { name: '', nameHe: '', emoji: '👨', deviceType: 'phone' },
    { name: '', nameHe: '', emoji: '👩', deviceType: 'phone' },
    { name: '', nameHe: '', emoji: '🧒', deviceType: 'phone' },
    { name: '', nameHe: '', emoji: '🧒', deviceType: 'phone' },
    { name: '', nameHe: '', emoji: '👶', deviceType: 'tablet' },
  ]);
  const [files, setFiles] = useState<File[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<string>('');
  const [parseError, setParseError] = useState('');
  const [apiKey, setApiKey] = useState(localStorage.getItem('claudeApiKey') || '');
  const [creating, setCreating] = useState(false);

  const isHe = i18n.language === 'he';

  // When user signs in with Google, check if their profile has a saved tripCode
  useEffect(() => {
    if (!firebaseUser || tripCode) return;
    (async () => {
      const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (snap.exists()) {
        const savedCode = snap.data().tripCode as string | undefined;
        if (savedCode) {
          const ok = await setTripCode(savedCode);
          if (ok) { navigate('/'); return; }
        }
      }
      // Signed in but no saved trip → pre-fill join mode
      setMode('join');
    })();
  }, [firebaseUser]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGoogleSignIn() {
    setGoogleError('');
    setGoogleSigningIn(true);
    try {
      await signInWithGoogle();
      // useEffect above will react to firebaseUser change
    } catch (e: any) {
      setGoogleError(e.message);
      setGoogleSigningIn(false);
    }
  }

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
    if (!newTripCode.trim()) return;
    setCreating(true);
    try {
      const config: TripConfig = {
        tripCode: newTripCode.trim().toLowerCase(),
        tripName,
        startDate: '2026-03-24',
        endDate: '2026-04-04',
        familyMembers: members.map((m, i) => ({
          id: `member-${i}`,
          name: m.name || `Member ${i + 1}`,
          nameHe: m.nameHe || m.name || `בן משפחה ${i + 1}`,
          emoji: m.emoji || '👤',
          deviceType: m.deviceType || 'phone',
        })),
      };
      await saveTripConfig(config);
      await setTripCode(config.tripCode);
      setMode('upload');
    } catch (err: any) {
      setParseError(err.message);
    } finally {
      setCreating(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  }

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Extract base64 part after data:...;base64,
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleParse() {
    if (!files.length) return;
    if (!apiKey) {
      setParseError(isHe ? 'נדרש מפתח Claude API' : 'Claude API key required');
      return;
    }
    localStorage.setItem('claudeApiKey', apiKey);
    setParsing(true);
    setParseError('');

    try {
      const imageContents = await Promise.all(
        files.map(async (file) => {
          const base64 = await fileToBase64(file);
          const mediaType = file.type || 'image/png';
          return {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: mediaType,
              data: base64,
            },
          };
        })
      );

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: [
                ...imageContents,
                {
                  type: 'text',
                  text: `Extract all travel booking information from these confirmation screenshots/PDFs. Return a JSON object with the following structure:
{
  "flights": [{ "id": "flight-1", "dayIndex": 0, "airline": "", "flightNumber": "", "departureAirport": "", "departureAirportCode": "", "arrivalAirport": "", "arrivalAirportCode": "", "departureTime": "ISO datetime", "arrivalTime": "ISO datetime", "terminal": "", "gate": "", "confirmationCode": "" }],
  "hotels": [{ "id": "hotel-1", "dayIndexStart": 0, "dayIndexEnd": 3, "name": "", "address": "", "city": "", "checkIn": "ISO datetime", "checkOut": "ISO datetime", "confirmationCode": "" }]
}

Trip starts March 24, 2026 (dayIndex 0) and ends April 4, 2026 (dayIndex 11).
Calculate dayIndex based on the dates relative to March 24.
Only include fields you can extract. Return ONLY valid JSON, no markdown.`,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`API error: ${response.status} - ${err}`);
      }

      const data = await response.json();
      const text = data.content[0]?.text || '';
      setParsedData(text);
    } catch (err: any) {
      setParseError(err.message);
    } finally {
      setParsing(false);
    }
  }

  async function handleSaveParsed() {
    if (!parsedData || !tripCode) return;
    try {
      const parsed = JSON.parse(parsedData);
      await importTripData(tripCode, parsed);
      navigate('/');
    } catch (err: any) {
      setParseError(`Invalid JSON: ${err.message}`);
    }
  }

  // Choice screen
  if (mode === 'choice') {
    return (
      <div className="setup-page">
        <div className="setup-hero">
          <div className="setup-emoji">🇬🇷</div>
          <h1>{t('app.title')}</h1>
          <p>{t('app.subtitle')}</p>
        </div>

        <div className="setup-choices">
          {!authLoading && !firebaseUser && (
            <>
              <button
                className="google-signin-btn"
                onClick={handleGoogleSignIn}
                disabled={googleSigningIn}
                style={{ width: '100%', justifyContent: 'center', marginBottom: '8px' }}
              >
                {googleSigningIn ? (
                  <Loader size={18} className="spin" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                )}
                {t('auth.signInWithGoogle')}
              </button>
              {googleError && (
                <p className="setup-error"><AlertCircle size={16} /> {googleError}</p>
              )}
              <div className="setup-or">{t('setup.or')}</div>
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
      </div>
    );
  }

  // Join screen
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

  // Create trip screen
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
              placeholder="e.g., greece2026"
              value={newTripCode}
              onChange={(e) => setNewTripCode(e.target.value)}
            />
          </label>

          <label className="setup-label">
            {isHe ? 'שם הטיול' : 'Trip Name'}
            <input
              type="text"
              className="setup-input"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
            />
          </label>

          <h3>{isHe ? 'בני המשפחה' : 'Family Members'}</h3>
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

          {parseError && <p className="setup-error"><AlertCircle size={16} /> {parseError}</p>}

          <button
            className="setup-btn primary"
            onClick={handleCreateTrip}
            disabled={creating || !newTripCode.trim()}
          >
            {creating ? <Loader size={16} className="spin" /> : null}
            {t('setup.createTrip')}
          </button>
          <button className="setup-btn secondary" onClick={() => setMode('choice')}>
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  // Upload screen (after trip created)
  if (mode === 'upload') {
    return (
      <div className="setup-page">
        <h2>{t('setup.uploadTitle')}</h2>
        <p className="setup-description">{t('setup.uploadDescription')}</p>

        <div className="setup-form">
          <label className="setup-label">
            Claude API Key
            <input
              type="password"
              className="setup-input"
              placeholder="sk-ant-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </label>

          <div
            className="upload-zone"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={40} />
            <p>{t('setup.selectFiles')}</p>
            {files.length > 0 && (
              <div className="file-list">
                {files.map((f, i) => (
                  <div key={i} className="file-item">
                    <FileText size={16} />
                    <span>{f.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {parsing && (
            <div className="parsing-status">
              <Loader size={20} className="spin" />
              <span>{t('setup.parsing')}</span>
            </div>
          )}

          {parsedData && (
            <div className="parsed-preview">
              <div className="parsed-header">
                <Check size={20} /> {t('setup.parsed')}
              </div>
              <textarea
                className="parsed-json"
                value={parsedData}
                onChange={(e) => setParsedData(e.target.value)}
                rows={10}
              />
              <button className="setup-btn primary" onClick={handleSaveParsed}>
                {t('setup.save')}
              </button>
            </div>
          )}

          {parseError && <p className="setup-error"><AlertCircle size={16} /> {parseError}</p>}

          {!parsedData && (
            <button
              className="setup-btn primary"
              onClick={handleParse}
              disabled={parsing || !files.length}
            >
              {t('setup.review')}
            </button>
          )}

          <button className="setup-btn secondary" onClick={() => navigate('/')}>
            {isHe ? 'דלג והמשך' : 'Skip & Continue'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
