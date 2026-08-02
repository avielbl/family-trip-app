import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { useTripContext } from '../context/TripContext';
import { earnStamp, deletePassportStamp, savePassportStamp } from '../firebase/tripService';
import AISuggestPanel from '../components/AISuggestPanel';
import type { PassportStamp } from '../types/ai';

// ─── Legacy fallback (no Firestore stamps yet) ────────────────────────────────

const DEFAULT_STAMP_THEME = { emoji: '🏛️', color: '#8b6914' };

const DAY_STAMP_THEMES: Record<number, { emoji: string; color: string }> = {
  1:  { emoji: '✈️', color: '#4a90d9' },
  2:  { emoji: '🏛️', color: '#8b6914' },
  3:  { emoji: '🏛️', color: '#c0392b' },
  4:  { emoji: '🏖️', color: '#2ecc71' },
  5:  { emoji: '⛵', color: '#3498db' },
  6:  { emoji: '🏔️', color: '#7f8c8d' },
  7:  { emoji: '🏛️', color: '#8e44ad' },
  8:  { emoji: '🏖️', color: '#1abc9c' },
  9:  { emoji: '🫒', color: '#27ae60' },
  10: { emoji: '🎭', color: '#e74c3c' },
  11: { emoji: '🏖️', color: '#f39c12' },
  12: { emoji: '✈️', color: '#2c3e50' },
};

// ─── Main component ───────────────────────────────────────────────────────────

const PassportPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const {
    passportStamps,
    earnedStamps,
    highlights,
    hotels,
    driving,
    days,
    tripCode,
    isAdmin,
    currentMember,
    config,
    totalDays,
  } = useTripContext();

  const isHebrew = i18n.language === 'he';
  const useNewSystem = passportStamps.length > 0;

  // ─── New system ──────────────────────────────────────────────────────────────

  const earnedCount = useMemo(() =>
    passportStamps.filter((s) =>
      earnedStamps.some((e) => e.stampId === s.id && e.memberId === (currentMember?.id ?? ''))
    ).length,
  [passportStamps, earnedStamps, currentMember]);

  if (useNewSystem) {
    return (
      <div className="passport-page" dir={isHebrew ? 'rtl' : 'ltr'}>
        <div className="passport-book">
          <div className="passport-header">
            <div className="passport-emblem">🇬🇷</div>
            <h1>{t('passport.title')}</h1>
            <div className="passport-subtitle">{config?.destination || config?.tripName || ''}</div>
          </div>

          <div className="stamp-count">
            {earnedCount === passportStamps.length && passportStamps.length > 0 ? (
              <div className="all-collected">
                <span className="celebration-emoji">🎉</span>
                <span>{t('passport.allCollected')}</span>
                <span className="celebration-emoji">🎉</span>
              </div>
            ) : (
              <p>{isHebrew
                ? `${earnedCount} מתוך ${passportStamps.length} חותמות`
                : `${earnedCount} of ${passportStamps.length} stamps`}
              </p>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="passport-generate-row">
            <AISuggestPanel
              type="passport-stamp"
              context={{ destination: config?.destination || config?.tripName, hotels, driving, days, existing: passportStamps }}
              onAccept={(items) => {
                if (!tripCode) return;
                items.forEach((item) => {
                  const stamp: PassportStamp = {
                    id: `stamp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    dayIndex: Number(item.dayIndex ?? 0),
                    title: String(item.title ?? 'Stamp'),
                    titleHe: item.titleHe ? String(item.titleHe) : undefined,
                    description: String(item.description ?? ''),
                    icon: String(item.icon ?? '🏛️'),
                    location: String(item.location ?? ''),
                    earnCondition: String(item.earnCondition ?? ''),
                  };
                  savePassportStamp(tripCode, stamp);
                });
              }}
            />
          </div>
        )}

        <div className="passport-stamps-grid">
          {[...passportStamps]
            .sort((a, b) => a.dayIndex - b.dayIndex)
            .map((stamp) => {
              const isEarned = earnedStamps.some(
                (e) => e.stampId === stamp.id && e.memberId === (currentMember?.id ?? '')
              );
              const linkedHighlight = stamp.highlightId
                ? highlights.find((h) => h.id === stamp.highlightId)
                : null;
              const autoEarnable = linkedHighlight?.completed ?? false;

              return (
                <div
                  key={stamp.id}
                  className={`passport-stamp-card ${isEarned ? 'earned' : 'unearned'}`}
                >
                  {isEarned && (
                    <div className="passport-stamp-earned-badge">{t('passport.stampEarned')}</div>
                  )}
                  {isAdmin && (
                    <button
                      style={{
                        position: 'absolute', top: '6px',
                        [isHebrew ? 'right' : 'left']: '6px',
                        background: 'none', border: 'none',
                        cursor: 'pointer', color: 'var(--red-400)',
                        fontSize: '16px', lineHeight: 1, padding: '0',
                      }}
                      onClick={() => tripCode && deletePassportStamp(tripCode, stamp.id)}
                      title={isHebrew ? 'מחק' : 'Delete'}
                    >×</button>
                  )}
                  <div className="passport-stamp-icon">{stamp.icon}</div>
                  <div className="passport-stamp-title">
                    {isHebrew && stamp.titleHe ? stamp.titleHe : stamp.title}
                  </div>
                  <div className="passport-stamp-location">
                    {isHebrew ? 'יום' : 'Day'} {stamp.dayIndex + 1} · {stamp.location}
                  </div>

                  {!isEarned && (stamp.highlightId ? (
                    autoEarnable && currentMember && tripCode ? (
                      <button
                        className="passport-stamp-earn-btn"
                        onClick={() => earnStamp(tripCode, currentMember.id, stamp.id)}
                      >
                        {t('passport.earnBtn')}
                      </button>
                    ) : (
                      <div className="passport-stamp-earn-hint">
                        {t('passport.visitToEarn', {
                          name: linkedHighlight?.name ?? '...',
                        })}
                      </div>
                    )
                  ) : (
                    currentMember && tripCode && (
                      <button
                        className="passport-stamp-earn-btn"
                        onClick={() => earnStamp(tripCode, currentMember.id, stamp.id)}
                      >
                        {t('passport.earnBtn')}
                      </button>
                    )
                  ))}
                </div>
              );
            })}
        </div>

        {passportStamps.length === 0 && !isAdmin && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '32px' }}>
            {t('passport.noStamps')}
          </p>
        )}
      </div>
    );
  }

  // ─── Legacy day-based system ──────────────────────────────────────────────

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

        {isAdmin && (
          <div className="passport-generate-row">
            <AISuggestPanel
              type="passport-stamp"
              context={{ destination: config?.destination || config?.tripName, hotels, driving, days, existing: [] }}
              onAccept={(items) => {
                if (!tripCode) return;
                items.forEach((item) => {
                  const stamp: PassportStamp = {
                    id: `stamp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    dayIndex: Number(item.dayIndex ?? 0),
                    title: String(item.title ?? 'Stamp'),
                    description: String(item.description ?? ''),
                    icon: String(item.icon ?? '🏛️'),
                    location: String(item.location ?? ''),
                    earnCondition: String(item.earnCondition ?? ''),
                  };
                  savePassportStamp(tripCode, stamp);
                });
              }}
            />
          </div>
        )}

        <div className="stamp-grid">
          {Array.from({ length: totalDays }, (_, index) => {
            const dayNumber = index + 1;
            const isEarned = earnedDays.has(index);
            const theme = DAY_STAMP_THEMES[dayNumber] || DEFAULT_STAMP_THEME;

            return (
              <div key={index} className={`stamp-slot ${isEarned ? 'stamp-earned' : 'stamp-pending'}`}>
                <div className="stamp-day-label">
                  {t('passport.dayStamp', { day: dayNumber })}
                </div>
                {isEarned ? (
                  <div className="stamp-design" style={{ borderColor: theme.color, color: theme.color }}>
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
