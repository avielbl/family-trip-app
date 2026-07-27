import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { useTripContext } from '../context/TripContext';

const DEFAULT_STAMP_THEME = { emoji: '🏛️', color: '#8b6914' };

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
  const { highlights, config, totalDays } = useTripContext();

  const isHebrew = i18n.language === 'he';

  const earnedDays = useMemo(() => {
    const earned = new Set<number>();
    if (highlights) {
      highlights.forEach((highlight) => {
        if (highlight.completed) {
          const dayIndex = highlight.dayIndex;
          if (dayIndex !== undefined && dayIndex >= 0 && dayIndex < totalDays) {
            earned.add(dayIndex);
          }
        }
      });
    }
    return earned;
  }, [highlights, totalDays]);

  const stampsCollected = earnedDays.size;
  const allCollected = totalDays > 0 && stampsCollected === totalDays;

  let datesLine = '';
  if (config) {
    try {
      datesLine = `${format(parseISO(config.startDate), 'MMM d')} – ${format(parseISO(config.endDate), 'MMM d')}`;
    } catch {
      datesLine = '';
    }
  }

  return (
    <div className="passport-page" dir={isHebrew ? 'rtl' : 'ltr'}>
      <div className="passport-book">
        <div className="passport-header">
          <div className="passport-emblem">{config?.flagEmoji ?? '✈️'}</div>
          <h1>{t('passport.title')}</h1>
          <div className="passport-subtitle">{config?.tripName ?? ''}</div>
          {datesLine && <div className="passport-dates">{datesLine}</div>}
        </div>

        <div className="stamp-count">
          {allCollected ? (
            <div className="all-collected">
              <span className="celebration-emoji">🎉</span>
              <span>{t('passport.allCollected')}</span>
              <span className="celebration-emoji">🎉</span>
            </div>
          ) : (
            <p>{t('passport.stampsCollected', { count: stampsCollected, total: totalDays })}</p>
          )}
        </div>

        <div className="stamp-grid">
          {Array.from({ length: totalDays }, (_, index) => {
            const dayNumber = index + 1;
            const isEarned = earnedDays.has(index);
            const theme = DAY_STAMP_THEMES[dayNumber] || DEFAULT_STAMP_THEME;

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
