import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shield, Users, Link, Copy, Check, Save, Plus, Trash2, AlertCircle, Cpu, Loader } from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import { useAuthContext } from '../context/AuthContext';
import { claimAdminUid } from '../firebase/authService';
import { saveTripConfig } from '../firebase/tripService';
import { getAIConfig, setAIConfig, callAI, PROVIDER_PRESETS, PROVIDER_KEY_URLS } from '../firebase/aiService';
import type { FamilyMember } from '../types/trip';
import type { AIConfig } from '../types/ai';

export default function AdminPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { config, tripCode, isAdmin } = useTripContext();
  const { firebaseUser } = useAuthContext();
  const isHe = i18n.language === 'he';

  const [aiConfig, setAiConfigState] = useState<AIConfig>(getAIConfig);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState('');
  const [aiSaved, setAiSaved] = useState(false);

  const [members, setMembers] = useState<FamilyMember[]>(
    config?.familyMembers ?? []
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [claimMsg, setClaimMsg] = useState('');

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

  function handleSaveAI() {
    setAIConfig(aiConfig);
    setAiSaved(true);
    setTimeout(() => setAiSaved(false), 2000);
  }

  async function handleTestAI() {
    setAiTesting(true);
    setAiTestResult('');
    try {
      await callAI('Reply with exactly the word: ok');
      setAiTestResult(isHe ? t('ai.testOk') : t('ai.testOk'));
    } catch (e: any) {
      setAiTestResult(`${t('ai.testFail')}: ${e.message}`);
    } finally {
      setAiTesting(false);
    }
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
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
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

      {/* AI Configuration */}
      <div className="admin-section ai-config-section">
        <div className="admin-section-title">
          <Cpu size={16} />
          {isHe ? 'הגדרות AI' : 'AI Configuration'}
        </div>

        <div className="ai-config-row">
          <label className="ai-config-label">{t('ai.provider')}</label>
          <select
            className="ai-config-select"
            value={aiConfig.provider}
            onChange={(e) => {
              const p = e.target.value as AIConfig['provider'];
              setAiConfigState({ ...aiConfig, provider: p, model: PROVIDER_PRESETS[p][0] });
            }}
          >
            <option value="gemini">Google Gemini</option>
            <option value="groq">Groq (Llama)</option>
            <option value="claude">Anthropic Claude</option>
          </select>
        </div>

        <div className="ai-config-row">
          <label className="ai-config-label">{t('ai.model')}</label>
          <input
            className="ai-config-input"
            value={aiConfig.model}
            onChange={(e) => setAiConfigState({ ...aiConfig, model: e.target.value })}
          />
          <div className="ai-config-presets">
            {PROVIDER_PRESETS[aiConfig.provider].map((preset) => (
              <button
                key={preset}
                className="ai-config-preset-btn"
                onClick={() => setAiConfigState({ ...aiConfig, model: preset })}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="ai-config-row">
          <label className="ai-config-label">{t('ai.apiKey')}</label>
          <input
            className="ai-config-input"
            type="password"
            value={aiConfig.apiKey}
            onChange={(e) => setAiConfigState({ ...aiConfig, apiKey: e.target.value })}
            placeholder="sk-..."
          />
          <p className="ai-key-hint">
            {t('ai.getKeyHint')}{' '}
            <a href={PROVIDER_KEY_URLS[aiConfig.provider]} target="_blank" rel="noopener noreferrer">
              {PROVIDER_KEY_URLS[aiConfig.provider].replace('https://', '')}
            </a>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="admin-btn secondary"
            onClick={handleTestAI}
            disabled={aiTesting || !aiConfig.apiKey}
          >
            {aiTesting ? <Loader size={14} className="spin" /> : null}
            {t('ai.testBtn')}
          </button>
          <button className="admin-btn primary" onClick={handleSaveAI}>
            {aiSaved ? <Check size={14} /> : null}
            {aiSaved ? (isHe ? 'נשמר!' : 'Saved!') : t('ai.saveConfig')}
          </button>
        </div>

        {aiTestResult && (
          <div className={`ai-test-result ${aiTestResult.includes('✓') || aiTestResult.toLowerCase().includes('ok') ? 'ok' : 'err'}`}>
            {aiTestResult}
          </div>
        )}
      </div>

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
    </div>
  );
}
