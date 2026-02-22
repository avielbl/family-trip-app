import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTripContext } from '../context/TripContext';

const TOTAL_DAYS = 12;

const DAY_STAMP_THEMES: Record<number, { emoji: string; color: string }> = {
  1: { emoji: '✈️', color: '#4a90d9' },
  2: { emoji: '🏛️', color: '#8b6914' },
  3: { emoji: '🏛️', color: '#c0392b' },
  4: { emoji: '🏖️', color: '#2ecc71' },
  5: { emoji: '⛵', color: '#3498db' },
  6: { emoji: '🏔️', color: '#7f8c8d' },
  7: { emoji: '🏛️', color: '#8e44ad' },
  8: { emoji: '🏖️', color: '#1abc9c' },
  9: { emoji: '🫒', color: '#27ae60' },
  10: { emoji: '🎭', color: '#e74c3c' },
  11: { emoji: '🏖️', color: '#f39c12' },
  12: { emoji: '✈️', color: '#2c3e50' },
};

const PassportPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { highlights } = useTripContext();

  const isHebrew = i18n.language === 'he';

  const earnedDays = useMemo(() => {
    const earned = new Set<number>();
    if (highlights) {
      highlights.forEach((highlight) => {
        if (highlight.completed) {
          const dayIndex = highlight.dayIndex;
          if (dayIndex !== undefined && dayIndex >= 0 && dayIndex < TOTAL_DAYS) {
            earned.add(dayIndex);
          }
        }
      });
    }
    return earned;
  }, [highlights]);

  const stampsCollected = earnedDays.size;
  const allCollected = stampsCollected === TOTAL_DAYS;

  return (
    <div className="passport-page" dir={isHebrew ? 'rtl' : 'ltr'}>
      <div className="passport-book">
        <div className="passport-header">
          <div className="passport-emblem">🇬🇷</div>
          <h1>{t('passport.title')}</h1>
          <div className="passport-subtitle">Greece 2026</div>
          <div className="passport-dates">March 24 – April 4</div>
        </div>

        <div className="stamp-count">
          {allCollected ? (
            <div className="all-collected">
              <span className="celebration-emoji">🎉</span>
              <span>{t('passport.allCollected')}</span>
              <span className="celebration-emoji">🎉</span>
            </div>
          ) : (
            <p>{t('passport.stampsCollected', { count: stampsCollected, total: TOTAL_DAYS })}</p>
          )}
        </div>

        <div className="stamp-grid">
          {Array.from({ length: TOTAL_DAYS }, (_, index) => {
            const dayNumber = index + 1;
            const isEarned = earnedDays.has(index);
            const theme = DAY_STAMP_THEMES[dayNumber] || { emoji: '🏛️', color: '#8b6914' };

            return (
              <div
                key={index}
                className={`stamp-slot ${isEarned ? 'stamp-earned' : 'stamp-pending'}`}
              >
                <div className="stamp-day-label">
                  {t('passport.dayStamp', { day: dayNumber })}
                </div>
                {isEarned ? (
                  <div
                    className="stamp-design"
                    style={{ borderColor: theme.color, color: theme.color }}
                  >
                    <span className="stamp-emoji">{theme.emoji}</span>
                    <div className="stamp-ring" style={{ borderColor: theme.color }} />
                  </div>
                ) : (
                  <div className="stamp-placeholder">
                    <span className="stamp-emoji faded">{theme.emoji}</span>
                    <span className="earn-text">{t('passport.earnStamp')}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PassportPage;
