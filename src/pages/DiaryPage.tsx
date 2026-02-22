import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, CheckCircle, Camera, Copy, Check } from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import { saveDiaryNote } from '../firebase/tripService';
import { format } from 'date-fns';

const categoryEmoji: Record<string, string> = {
  beach: '🏖️',
  ruins: '🏛️',
  museum: '🏛️',
  food: '🍽️',
  'kids-fun': '🎡',
  nature: '🌿',
  shopping: '🛍️',
  viewpoint: '🔭',
  other: '📍',
};

export default function DiaryPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const {
    config,
    days,
    highlights,
    photos,
    restaurants,
    diaryNotes,
    tripCode,
  } = useTripContext();

  const [selectedDay, setSelectedDay] = useState(0);
  const [noteText, setNoteText] = useState<Record<number, string>>({});
  const [savedDays, setSavedDays] = useState<Set<number>>(new Set());
  const [showGenerated, setShowGenerated] = useState(false);
  const [copied, setCopied] = useState(false);

  const noteMap: Record<number, string> = {};
  diaryNotes.forEach((n) => { noteMap[n.dayIndex] = n.text; });

  const getNoteText = (dayIndex: number) =>
    dayIndex in noteText ? noteText[dayIndex] : (noteMap[dayIndex] ?? '');

  const handleSaveNote = async (dayIndex: number) => {
    if (!tripCode) return;
    await saveDiaryNote(tripCode, dayIndex, getNoteText(dayIndex));
    setSavedDays((prev) => new Set(prev).add(dayIndex));
    setTimeout(() => setSavedDays((prev) => { const s = new Set(prev); s.delete(dayIndex); return s; }), 2000);
  };

  const sortedDays = [...days].sort((a, b) => a.dayIndex - b.dayIndex);

  const dayHighlights = (dayIndex: number) =>
    highlights.filter((h) => h.dayIndex === dayIndex && h.completed);

  const dayPhotos = (dayIndex: number) =>
    photos.filter((p) => p.dayIndex === dayIndex);

  const generateDiary = () => {
    const lines: string[] = [];
    const tripName = config?.tripName ?? 'Family Trip';
    lines.push(`=== ${tripName} ===`);
    lines.push('');

    sortedDays.forEach((day) => {
      const dHighlights = dayHighlights(day.dayIndex);
      const dPhotos = dayPhotos(day.dayIndex);
      const note = noteMap[day.dayIndex] ?? '';
      const hasContent = dHighlights.length > 0 || dPhotos.length > 0 || note.trim();
      if (!hasContent) return;

      const dayTitle = isRTL ? day.titleHe : day.title;
      const location = isRTL ? (day.locationHe ?? day.location) : day.location;
      let dateStr = '';
      try { dateStr = format(new Date(day.date), 'MMMM d, yyyy'); } catch { dateStr = day.date; }

      lines.push(`--- Day ${day.dayIndex + 1}: ${dayTitle} | ${location} | ${dateStr} ---`);

      if (dHighlights.length > 0) {
        lines.push(`Visited:`);
        dHighlights.forEach((h) => {
          const name = isRTL && h.nameHe ? h.nameHe : h.name;
          lines.push(`  ${categoryEmoji[h.category] ?? '📍'} ${name}`);
        });
      }

      if (dPhotos.length > 0) {
        lines.push(`Photos: ${dPhotos.length} photo${dPhotos.length > 1 ? 's' : ''}`);
      }

      if (note.trim()) {
        lines.push(`Notes: ${note.trim()}`);
      }

      lines.push('');
    });

    const visitedRestaurants = restaurants.filter((r) => r.visited);
    if (visitedRestaurants.length > 0) {
      lines.push('--- Restaurants Visited ---');
      visitedRestaurants.forEach((r) => {
        const name = isRTL && r.nameHe ? r.nameHe : r.name;
        const ratings = Object.values(r.ratings);
        const avg = ratings.length
          ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
          : null;
        lines.push(`  🍽️ ${name}${avg ? ` (${avg}★)` : ''}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generateDiary());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentDay = sortedDays[selectedDay];

  return (
    <div style={{ paddingBottom: 16 }}>
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <BookOpen size={24} />
        {t('diary.title')}
      </h1>

      {/* Day Tabs */}
      <div className="day-tabs">
        {sortedDays.map((day, idx) => {
          const hasActivity =
            dayHighlights(day.dayIndex).length > 0 ||
            dayPhotos(day.dayIndex).length > 0 ||
            noteMap[day.dayIndex];
          return (
            <button
              key={day.dayIndex}
              className={`day-tab ${selectedDay === idx ? 'active' : ''}`}
              onClick={() => setSelectedDay(idx)}
              style={{ position: 'relative' }}
            >
              {day.dayIndex + 1}
              {hasActivity && (
                <span style={{
                  position: 'absolute',
                  top: -3,
                  insetInlineEnd: -3,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--green-500)',
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Current Day Card */}
      {currentDay && (
        <div className="card">
          {/* Day Header */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--gray-900)' }}>
              {t('diary.dayLabel', { day: currentDay.dayIndex + 1 })} —{' '}
              {isRTL ? currentDay.titleHe : currentDay.title}
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>
              {(() => {
                try { return format(new Date(currentDay.date), 'EEEE, MMMM d, yyyy'); } catch { return currentDay.date; }
              })()}
              {' · '}
              {isRTL ? (currentDay.locationHe ?? currentDay.location) : currentDay.location}
            </div>
          </div>

          {/* Completed Highlights */}
          {dayHighlights(currentDay.dayIndex).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', marginBottom: 6 }}>
                <CheckCircle size={14} style={{ display: 'inline', marginInlineEnd: 4 }} />
                {t('diary.visited')}
              </div>
              {dayHighlights(currentDay.dayIndex).map((h) => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 14, color: 'var(--gray-700)' }}>
                  <span>{categoryEmoji[h.category] ?? '📍'}</span>
                  <span>{isRTL && h.nameHe ? h.nameHe : h.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Photos */}
          {dayPhotos(currentDay.dayIndex).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', marginBottom: 6 }}>
                <Camera size={14} style={{ display: 'inline', marginInlineEnd: 4 }} />
                {t('diary.photos', { count: dayPhotos(currentDay.dayIndex).length })}
              </div>
              <div className="photo-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {dayPhotos(currentDay.dayIndex).map((p) => (
                  <div key={p.id} className="photo-card">
                    <img src={p.imageUrl} alt={p.caption ?? ''} className="photo-img" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {dayHighlights(currentDay.dayIndex).length === 0 &&
            dayPhotos(currentDay.dayIndex).length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--gray-400)', fontStyle: 'italic', marginBottom: 10 }}>
              {t('diary.nothingYet')}
            </div>
          )}

          {/* Note */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', marginBottom: 6 }}>
              📝 {t('diary.notesLabel')}
            </div>
            <textarea
              value={getNoteText(currentDay.dayIndex)}
              onChange={(e) =>
                setNoteText((prev) => ({ ...prev, [currentDay.dayIndex]: e.target.value }))
              }
              placeholder={t('diary.notesPlaceholder')}
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--gray-200)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'vertical',
                lineHeight: 1.5,
              }}
            />
            <button
              onClick={() => handleSaveNote(currentDay.dayIndex)}
              style={{
                marginTop: 8,
                padding: '8px 16px',
                background: savedDays.has(currentDay.dayIndex) ? 'var(--green-500)' : 'var(--blue-600)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {savedDays.has(currentDay.dayIndex) ? (
                <><Check size={14} /> {t('diary.saved')}</>
              ) : t('diary.saveNote')}
            </button>
          </div>
        </div>
      )}

      {/* Generate Diary */}
      <button
        onClick={() => setShowGenerated(!showGenerated)}
        style={{
          width: '100%',
          padding: '14px',
          background: 'var(--blue-600)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius)',
          cursor: 'pointer',
          fontSize: 15,
          fontWeight: 600,
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <BookOpen size={18} />
        {t('diary.generate')}
      </button>

      {showGenerated && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{t('diary.generatedTitle')}</span>
            <button
              onClick={handleCopy}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                background: copied ? 'var(--green-500)' : 'var(--gray-100)',
                color: copied ? 'white' : 'var(--gray-700)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            >
              {copied ? <><Check size={14} /> {t('diary.copied')}</> : <><Copy size={14} /> {t('diary.copy')}</>}
            </button>
          </div>
          <pre style={{
            whiteSpace: 'pre-wrap',
            fontSize: 13,
            color: 'var(--gray-700)',
            lineHeight: 1.6,
            fontFamily: 'inherit',
            background: 'var(--gray-50)',
            padding: 12,
            borderRadius: 'var(--radius-sm)',
            overflowX: 'auto',
          }}>
            {generateDiary()}
          </pre>
        </div>
      )}
    </div>
  );
}
