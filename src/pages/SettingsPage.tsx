import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Globe, User, Info, Calendar, LogOut, Link, Copy, Check, Sparkles } from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import { useAuthContext } from '../context/AuthContext';
import { AI_MODELS, getAiSettings, saveAiSettings, setAiProvider } from '../ai';
import type { AiProviderId, AiSettings } from '../ai';

const SettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { config, currentMember, setCurrentMember, tripCode, isAdmin } = useTripContext();
  const { firebaseUser, signOutUser } = useAuthContext();
  const [copied, setCopied] = useState(false);
  const [aiSettings, setAiSettings] = useState<AiSettings>(() => getAiSettings());

  const currentLang = i18n.language;
  const isHe = currentLang === 'he';

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
  };

  const inviteUrl = tripCode
    ? `${window.location.origin}/join/${tripCode}`
    : '';

  async function handleCopyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleAiProviderChange(provider: AiProviderId) {
    if (provider === aiSettings.provider) return;
    setAiSettings(setAiProvider(provider));
  }

  function handleAiChange(patch: Partial<AiSettings>) {
    const next = { ...aiSettings, ...patch };
    saveAiSettings(next);
    setAiSettings(next);
  }

  return (
    <div className="settings-page">
      <h1 className="page-title">
        <Settings size={24} style={{ display: 'inline', marginInlineEnd: '8px' }} />
        {t('settings.title')}
      </h1>

      {/* Google Account section */}
      {firebaseUser && (
        <section className="settings-section">
          <label className="settings-label">
            <User size={18} style={{ display: 'inline', marginInlineEnd: '6px' }} />
            {isHe ? 'חשבון Google' : 'Google Account'}
          </label>
          <div className="google-account-row">
            {firebaseUser.photoURL && (
              <img
                src={firebaseUser.photoURL}
                alt=""
                className="google-avatar"
              />
            )}
            <div className="google-account-info">
              <div className="google-name">{firebaseUser.displayName}</div>
              <div className="google-email">{firebaseUser.email}</div>
            </div>
          </div>
          <button className="settings-btn danger" onClick={signOutUser}>
            <LogOut size={16} />
            {isHe ? 'התנתק' : 'Sign out'}
          </button>
        </section>
      )}

      <section className="settings-section">
        <label className="settings-label">
          <Globe size={18} style={{ display: 'inline', marginInlineEnd: '6px' }} />
          {t('settings.language')}
        </label>
        <div className="lang-toggle">
          <button
            className={currentLang === 'he' ? 'active' : ''}
            onClick={() => handleLanguageChange('he')}
          >
            עברית
          </button>
          <button
            className={currentLang === 'en' ? 'active' : ''}
            onClick={() => handleLanguageChange('en')}
          >
            English
          </button>
        </div>
      </section>

      <section className="settings-section">
        <label className="settings-label">
          <User size={18} style={{ display: 'inline', marginInlineEnd: '6px' }} />
          {t('settings.member')}
        </label>
        <div className="member-grid">
          {config?.familyMembers.map((member) => (
            <button
              key={member.id}
              className={`member-card ${
                currentMember?.id === member.id ? 'member-selected' : ''
              }`}
              onClick={() => setCurrentMember(member)}
            >
              <span className="member-emoji">{member.emoji}</span>
              <span className="member-name">
                {currentLang === 'he' ? member.nameHe : member.name}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <label className="settings-label">
          <Info size={18} style={{ display: 'inline', marginInlineEnd: '6px' }} />
          {t('settings.tripCode')}
        </label>
        <div className="trip-info">
          <input
            type="text"
            value={tripCode ?? ''}
            readOnly
            className="setup-input"
            style={{ marginBottom: '8px' }}
          />
        </div>
      </section>

      {/* Invite link — admin only */}
      {isAdmin && (
        <section className="settings-section">
          <label className="settings-label">
            <Link size={18} style={{ display: 'inline', marginInlineEnd: '6px' }} />
            {isHe ? 'קישור הצטרפות' : 'Invite Link'}
          </label>
          <div className="invite-row">
            <input
              type="text"
              value={inviteUrl}
              readOnly
              className="setup-input"
            />
            <button className="setup-btn primary" onClick={handleCopyInvite} style={{ marginTop: '8px' }}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied
                ? (isHe ? 'הועתק!' : 'Copied!')
                : (isHe ? 'העתק קישור' : 'Copy Link')}
            </button>
          </div>
        </section>
      )}

      {/* AI Assistant — admin only */}
      {isAdmin && (
        <section className="settings-section">
          <label className="settings-label">
            <Sparkles size={18} style={{ display: 'inline', marginInlineEnd: '6px' }} />
            {isHe ? 'עוזר AI' : 'AI Assistant'}
          </label>
          <div className="lang-toggle" style={{ marginBottom: '10px' }}>
            <button
              className={aiSettings.provider === 'anthropic' ? 'active' : ''}
              onClick={() => handleAiProviderChange('anthropic')}
            >
              Claude
            </button>
            <button
              className={aiSettings.provider === 'gemini' ? 'active' : ''}
              onClick={() => handleAiProviderChange('gemini')}
            >
              Gemini
            </button>
          </div>
          <label className="settings-label" style={{ fontSize: '13px' }}>
            {isHe ? 'מודל' : 'Model'}
            <input
              type="text"
              className="setup-input"
              list="ai-model-suggestions"
              value={aiSettings.model}
              onChange={(e) => handleAiChange({ model: e.target.value })}
              style={{ marginBottom: '8px' }}
            />
          </label>
          <datalist id="ai-model-suggestions">
            {AI_MODELS[aiSettings.provider].suggestions.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <label className="settings-label" style={{ fontSize: '13px' }}>
            {isHe ? 'מפתח API' : 'API Key'}
            <input
              type="password"
              className="setup-input"
              placeholder={aiSettings.provider === 'anthropic' ? 'sk-ant-...' : 'AIza...'}
              value={aiSettings.apiKey}
              onChange={(e) => handleAiChange({ apiKey: e.target.value })}
              style={{ marginBottom: '8px' }}
            />
          </label>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
            {isHe
              ? 'מפתחות Claude ב-console.anthropic.com · מפתחות Gemini ב-aistudio.google.com'
              : 'Claude keys at console.anthropic.com · Gemini keys at aistudio.google.com'}
          </p>
        </section>
      )}

      <section className="settings-section">
        <label className="settings-label">
          <Calendar size={18} style={{ display: 'inline', marginInlineEnd: '6px' }} />
          {t('settings.about')}
        </label>
        <div className="trip-info">
          <p>Greece Family Trip 2026 &mdash; Built with love</p>
          <p>
            {config?.startDate} &ndash; {config?.endDate}
          </p>
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;
