import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Settings, Globe, User, Info, Calendar, Moon, Upload } from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import { useTheme } from '../context/ThemeContext';

const SettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { config, currentMember, setCurrentMember, tripCode } = useTripContext();
  const { isDark, toggleDark } = useTheme();
  const navigate = useNavigate();

  const currentLang = i18n.language;

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
  };

  return (
    <div className="settings-page">
      <h1>
        <Settings size={24} />
        {t('settings.title')}
      </h1>

      <section className="settings-section">
        <label className="settings-label">
          <Globe size={18} />
          {t('settings.language')}
        </label>
        <div className="lang-toggle">
          <button
            className={currentLang === 'he' ? 'lang-toggle--active' : ''}
            onClick={() => handleLanguageChange('he')}
          >
            עברית
          </button>
          <button
            className={currentLang === 'en' ? 'lang-toggle--active' : ''}
            onClick={() => handleLanguageChange('en')}
          >
            English
          </button>
        </div>
      </section>

      <section className="settings-section">
        <label className="settings-label">
          <User size={18} />
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
              <span className="member-card__emoji">{member.emoji}</span>
              <span className="member-card__name">
                {currentLang === 'he' ? member.nameHe : member.name}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <label className="settings-label">
          <Moon size={18} />
          {t('settings.darkMode')}
        </label>
        <div className="lang-toggle">
          <button
            className={!isDark ? 'active' : ''}
            onClick={() => isDark && toggleDark()}
          >
            ☀️ Light
          </button>
          <button
            className={isDark ? 'active' : ''}
            onClick={() => !isDark && toggleDark()}
          >
            🌙 Dark
          </button>
        </div>
      </section>

      <section className="settings-section">
        <label className="settings-label">
          <Upload size={18} />
          {t('settings.importData')}
        </label>
        <button
          className="setup-btn primary"
          style={{ width: '100%' }}
          onClick={() => navigate('/setup')}
        >
          <Upload size={16} />
          {t('settings.importFlightsHotels')}
        </button>
      </section>

      <section className="settings-section">
        <label className="settings-label">
          <Info size={18} />
          {t('settings.tripCode')}
        </label>
        <div className="trip-info">
          <input type="text" value={tripCode ?? ''} readOnly />
        </div>
      </section>

      <section className="settings-section">
        <label className="settings-label">
          <Calendar size={18} />
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
