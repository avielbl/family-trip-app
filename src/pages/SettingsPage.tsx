import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Globe, User, Info, Calendar, LogOut, Link, Copy, Check } from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import { useAuthContext } from '../context/AuthContext';

const SettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { config, currentMember, setCurrentMember, tripCode, isAdmin } = useTripContext();
  const { firebaseUser, signOutUser } = useAuthContext();
  const [copied, setCopied] = useState(false);

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
