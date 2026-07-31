import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shield, Users, Link, Copy, Check, Save, Plus, Trash2, AlertCircle, HelpCircle, Sparkles, Loader2, FileUp } from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import { useAuthContext } from '../context/AuthContext';
import { useFamilyContext } from '../context/FamilyContext';
import { claimAdminUid } from '../firebase/authService';
import { saveTripConfig, saveQuizQuestion, deleteQuizQuestion } from '../firebase/tripService';
import { updateMemberTemplates } from '../firebase/familyService';
import { generateText, hasAiKey, stripJsonFences } from '../ai';
import { GREECE_QUIZ_SEED } from '../data/greeceQuizSeed';
import type { FamilyMember, QuizQuestion } from '../types/trip';

export default function AdminPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { config, tripCode, isAdmin, quizQuestions, totalDays } = useTripContext();
  const { firebaseUser } = useAuthContext();
  const { family, familyId } = useFamilyContext();
  const isHe = i18n.language === 'he';

  const [members, setMembers] = useState<FamilyMember[]>(
    config?.familyMembers ?? []
  );
  const [syncFamily, setSyncFamily] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [claimMsg, setClaimMsg] = useState('');
  const [quizBusy, setQuizBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [quizError, setQuizError] = useState('');

  const inviteUrl = tripCode
    ? `${window.location.origin}/join/${tripCode}`
    : '';

  if (!isAdmin) {
    return (
      <div className="admin-page">
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <Shield size={40} style={{ marginBottom: '12px', color: 'var(--red-400)' }} />
          <p>{isHe ? 'גישה מוגבלת למנהל בלבד' : 'Admin access only'}</p>
          <button
            className="setup-btn secondary"
            onClick={() => navigate('/')}
            style={{ marginTop: '16px' }}
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  async function handleCopyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleClaimAdmin() {
    if (!tripCode || !firebaseUser) return;
    await claimAdminUid(tripCode, firebaseUser.uid);
    setClaimMsg(isHe ? 'UID מנהל נשמר!' : 'Admin UID claimed!');
  }

  async function handleSaveMembers() {
    if (!config || !tripCode) return;
    setSaving(true);
    setError('');
    try {
      await saveTripConfig({ ...config, familyMembers: members });

      // Optionally propagate detail edits to the family roster: matching ids
      // are updated, new members appended. Roster members who simply aren't
      // on this trip are left untouched.
      if (syncFamily && familyId) {
        const templates = family?.memberTemplates ?? [];
        const byId = new Map(members.map((m) => [m.id, m]));
        const merged = [
          ...templates.map((tmpl) => byId.get(tmpl.id) ?? tmpl),
          ...members.filter((m) => !templates.some((tmpl) => tmpl.id === m.id)),
        ];
        await updateMemberTemplates(familyId, merged);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSeedQuiz() {
    if (!tripCode || quizBusy) return;
    setQuizBusy(true);
    setQuizError('');
    try {
      for (const q of GREECE_QUIZ_SEED) {
        await saveQuizQuestion(tripCode, q);
      }
    } catch (e) {
      setQuizError((e as Error).message);
    } finally {
      setQuizBusy(false);
    }
  }

  async function handleDeleteQuestion(id: string) {
    if (!tripCode) return;
    setQuizError('');
    try {
      await deleteQuizQuestion(tripCode, id);
    } catch (e) {
      setQuizError((e as Error).message);
    }
  }

  async function handleGenerateQuiz() {
    if (!tripCode || generating || !hasAiKey()) return;
    setGenerating(true);
    setQuizError('');
    try {
      const destination = config?.destination ?? config?.tripName ?? '';
      const prompt = `Create EXACTLY ${totalDays} kid-friendly multiple-choice quiz questions about ${destination} for a family trip.
One question per day: dayIndex 0 to ${totalDays - 1}, ids "q1" to "q${totalDays}".
Each question must be bilingual (English + Hebrew) with 4 options and a fun fact.
Return a JSON array where each item matches exactly this shape:
{"id":"q1","dayIndex":0,"question":"","questionHe":"","options":["","","",""],"optionsHe":["","","",""],"correctIndex":0,"funFact":"","funFactHe":""}
Return ONLY valid JSON, no markdown.`;
      const raw = await generateText(prompt, 8192);
      const parsed = JSON.parse(stripJsonFences(raw)) as QuizQuestion[];
      if (!Array.isArray(parsed)) {
        throw new Error(isHe ? 'תשובת ה-AI אינה מערך תקין' : 'AI response is not a valid array');
      }
      for (const q of parsed) {
        await saveQuizQuestion(tripCode, q);
      }
    } catch (e) {
      setQuizError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  function updateMember(idx: number, field: keyof FamilyMember, value: string | boolean) {
    const updated = [...members];
    updated[idx] = { ...updated[idx], [field]: value };
    setMembers(updated);
  }

  function addMember() {
    const newMember: FamilyMember = {
      id: `member-${Date.now()}`,
      name: '',
      nameHe: '',
      emoji: '👤',
      deviceType: 'phone',
    };
    setMembers([...members, newMember]);
  }

  function removeMember(idx: number) {
    setMembers(members.filter((_, i) => i !== idx));
  }

  return (
    <div className="admin-page">
      <h1 className="page-title">
        <Shield size={22} style={{ display: 'inline', marginInlineEnd: '8px' }} />
        {isHe ? 'ניהול טיול' : 'Trip Admin'}
      </h1>

      {/* Trip Info */}
      <div className="admin-section">
        <div className="admin-section-title">
          {isHe ? 'פרטי טיול' : 'Trip Info'}
        </div>
        <div className="trip-info">
          <p><strong>{isHe ? 'קוד' : 'Code'}:</strong> {tripCode}</p>
          <p><strong>{isHe ? 'שם' : 'Name'}:</strong> {config?.tripName}</p>
          <p><strong>{isHe ? 'תאריכים' : 'Dates'}:</strong> {config?.startDate} – {config?.endDate}</p>
        </div>
      </div>

      {/* Claim Admin */}
      {!config?.adminUid && (
        <div className="admin-section">
          <div className="admin-section-title">
            <Shield size={16} />
            {isHe ? 'תבע מנהל' : 'Claim Admin'}
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            {isHe
              ? 'אם עוד לא נדרשה הרשאת מנהל, לחץ/י כאן כדי לשייך את ה-UID שלך'
              : "Click to associate your UID as trip admin if it hasn't been set yet"}
          </p>
          <button className="admin-btn primary" onClick={handleClaimAdmin}>
            {isHe ? 'תבע הרשאת מנהל' : 'Claim Admin UID'}
          </button>
          {claimMsg && <p style={{ color: 'var(--green-600)', marginTop: '8px', fontSize: '13px' }}>{claimMsg}</p>}
        </div>
      )}

      {/* Booking import — screenshots/PDFs of flights, hotels, etc. */}
      <div className="admin-section">
        <div className="admin-section-title">
          <FileUp size={16} />
          {isHe ? 'ייבוא הזמנות' : 'Import Bookings'}
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          {isHe
            ? 'העלאת צילומי מסך או קבצי PDF של טיסות, מלונות והזמנות — והוספתם לטיול אוטומטית'
            : 'Upload screenshots or PDFs of flights, hotels and bookings — added to the trip automatically'}
        </p>
        <button className="admin-btn primary" onClick={() => navigate('/import')}>
          <FileUp size={14} />
          {isHe ? 'לייבוא הזמנות' : 'Open Import'}
        </button>
      </div>

      {/* Invite Link */}
      <div className="admin-section">
        <div className="admin-section-title">
          <Link size={16} />
          {isHe ? 'קישור הצטרפות' : 'Invite Link'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input type="text" value={inviteUrl} readOnly className="form-input" />
          <button className="admin-btn primary" onClick={handleCopyInvite}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied
              ? (isHe ? 'הועתק!' : 'Copied!')
              : (isHe ? 'העתק קישור' : 'Copy Invite Link')}
          </button>
        </div>
      </div>

      {/* Family Members */}
      <div className="admin-section">
        <div className="admin-section-title">
          <Users size={16} />
          {isHe ? 'בני משפחה' : 'Family Members'}
        </div>

        {members.map((m, idx) => (
          <div key={m.id} className="admin-member-row">
            <input
              className="admin-input"
              value={m.emoji}
              onChange={(e) => updateMember(idx, 'emoji', e.target.value)}
              style={{ width: '50px', textAlign: 'center' }}
              placeholder="🧑"
            />
            <input
              className="admin-input"
              value={m.name}
              onChange={(e) => updateMember(idx, 'name', e.target.value)}
              placeholder={isHe ? 'שם באנגלית' : 'Name'}
              style={{ flex: 1, minWidth: '80px' }}
            />
            <input
              className="admin-input"
              value={m.email ?? ''}
              onChange={(e) => updateMember(idx, 'email', e.target.value)}
              placeholder="email@..."
              type="email"
              style={{ flex: 1, minWidth: '100px' }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={m.isVirtual ?? false}
                onChange={(e) => updateMember(idx, 'isVirtual', e.target.checked)}
              />
              {isHe ? 'וירטואלי' : 'Virtual'}
            </label>
            <button
              className="admin-icon-btn delete"
              onClick={() => removeMember(idx)}
              title={t('common.delete')}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        {familyId && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)', marginTop: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={syncFamily}
              onChange={(e) => setSyncFamily(e.target.checked)}
            />
            {isHe
              ? 'עדכן גם את רשימת המשפחה הקבועה (לטיולים הבאים)'
              : 'Also update the family roster (used for future trips)'}
          </label>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button className="admin-btn secondary" onClick={addMember}>
            <Plus size={14} />
            {isHe ? 'הוסף בן משפחה' : 'Add Member'}
          </button>
          <button className="admin-btn primary" onClick={handleSaveMembers} disabled={saving}>
            {saved ? <Check size={14} /> : <Save size={14} />}
            {saved
              ? (isHe ? 'נשמר!' : 'Saved!')
              : (isHe ? 'שמור שינויים' : 'Save Changes')}
          </button>
        </div>

        {error && (
          <p style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--red-500)', fontSize: '13px', marginTop: '8px' }}>
            <AlertCircle size={14} /> {error}
          </p>
        )}
      </div>

      {/* Quiz Questions */}
      <div className="admin-section">
        <div className="admin-section-title">
          <HelpCircle size={16} />
          {isHe ? 'שאלות חידון' : 'Quiz Questions'} ({quizQuestions.length})
        </div>

        {[...quizQuestions]
          .sort((a, b) => a.dayIndex - b.dayIndex)
          .map((q) => (
            <div key={q.id} className="admin-member-row">
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '48px' }}>
                {t('common.day')} {q.dayIndex + 1}
              </span>
              <span style={{ flex: 1, fontSize: '13px' }}>
                {isHe ? q.questionHe : q.question}
              </span>
              <button
                className="admin-icon-btn delete"
                onClick={() => handleDeleteQuestion(q.id)}
                title={t('common.delete')}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
          {quizQuestions.length === 0 && (
            <button className="admin-btn secondary" onClick={handleSeedQuiz} disabled={quizBusy}>
              <Plus size={14} />
              {isHe ? 'טען שאלות יוון' : 'Seed Greece questions'}
            </button>
          )}
          <button
            className="admin-btn primary"
            onClick={handleGenerateQuiz}
            disabled={!hasAiKey() || generating}
          >
            {generating ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            {generating
              ? (isHe ? 'מייצר...' : 'Generating...')
              : (isHe ? 'ייצר עם AI' : 'Generate with AI')}
          </button>
        </div>

        {quizError && (
          <p style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--red-500)', fontSize: '13px', marginTop: '8px' }}>
            <AlertCircle size={14} /> {quizError}
          </p>
        )}
      </div>
    </div>
  );
}
