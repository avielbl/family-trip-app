import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StickyNote, Plus, Trash2, Check, RotateCcw, Wand2 } from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import { saveNote, deleteNote } from '../firebase/tripService';
import type { TripNote } from '../types/trip';

const CATEGORIES: Array<{ key: TripNote['category']; en: string; he: string; emoji: string }> = [
  { key: 'attraction', en: 'Attraction', he: 'אטרקציה', emoji: '⭐' },
  { key: 'restaurant', en: 'Restaurant', he: 'מסעדה', emoji: '🍽️' },
  { key: 'hotel', en: 'Hotel', he: 'מלון', emoji: '🏨' },
  { key: 'route', en: 'Route', he: 'מסלול', emoji: '🚗' },
  { key: 'general', en: 'General', he: 'כללי', emoji: '📝' },
];

export default function NotesPage() {
  const { t, i18n } = useTranslation();
  const { notes, tripCode, currentMember, isAdmin } = useTripContext();
  const isHe = i18n.language === 'he';

  const [text, setText] = useState('');
  const [relatedName, setRelatedName] = useState('');
  const [category, setCategory] = useState<TripNote['category']>('general');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'open' | 'all'>('open');

  const visible = filter === 'open' ? notes.filter((n) => n.status === 'open') : notes;
  const openCount = notes.filter((n) => n.status === 'open').length;

  async function handleAdd() {
    if (!tripCode || !text.trim() || saving) return;
    setSaving(true);
    try {
      const note: TripNote = {
        id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: text.trim(),
        category,
        relatedName: relatedName.trim() || undefined,
        createdBy: currentMember?.id,
        createdByName: isHe ? currentMember?.nameHe || currentMember?.name : currentMember?.name,
        createdAt: new Date().toISOString(),
        status: 'open',
      };
      await saveNote(tripCode, note);
      setText('');
      setRelatedName('');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(note: TripNote) {
    if (!tripCode) return;
    await saveNote(tripCode, { ...note, status: note.status === 'open' ? 'done' : 'open' });
  }

  async function handleDelete(note: TripNote) {
    if (!tripCode) return;
    if (!window.confirm(isHe ? 'למחוק את ההערה?' : 'Delete this note?')) return;
    await deleteNote(tripCode, note.id);
  }

  function handleAnalyzeWithAI() {
    const prompt = isHe
      ? 'עברו על הערות הטיול הפתוחות שלנו (מופיעות בהקשר שלך). הסבירו איך הן משפיעות על התוכנית ועל מסלולי הנסיעה, והציעו שינויים קונקרטיים לימים, לאטרקציות, למסעדות ולמסלולים — כולל פעולות שאפשר לאשר.'
      : 'Review our open trip notes (available in your context). Explain how they affect the plan and driving routes, and propose concrete amendments to days, attractions, restaurants, and routes — including approvable actions.';
    window.dispatchEvent(new CustomEvent('tripit:chat-prompt', { detail: { prompt } }));
  }

  const catOf = (key: TripNote['category']) => CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[4];

  return (
    <div className="quiz-page">
      <h1>
        <StickyNote size={24} />
        <span>{isHe ? 'הערות טיול' : 'Trip Notes'}</span>
      </h1>
      <p className="page-subtitle">
        {isHe
          ? 'אוספים כאן תובנות על אטרקציות, מסעדות ומסלולים — וה־AI יעזור לשלב אותן בתוכנית'
          : 'Collect thoughts about attractions, restaurants, and routes — the AI helps fold them into the plan'}
      </p>

      {/* Add note */}
      <div className="quiz-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              className={`filter-tab ${category === c.key ? 'active' : ''}`}
              onClick={() => setCategory(c.key)}
            >
              {c.emoji} {isHe ? c.he : c.en}
            </button>
          ))}
        </div>
        <input
          className="setup-input"
          style={{ width: '100%', marginBottom: 8 }}
          placeholder={isHe ? 'שם המקום (לא חובה)' : 'Place name (optional)'}
          value={relatedName}
          onChange={(e) => setRelatedName(e.target.value)}
        />
        <textarea
          className="setup-input"
          style={{ width: '100%', minHeight: 70, marginBottom: 8 }}
          placeholder={
            isHe
              ? 'למשל: "המסעדה בקוטור סגורה בימי שני" או "כדאי להגיע למפרץ לפני 10 בבוקר"'
              : 'e.g. "the Kotor restaurant is closed on Mondays" or "reach the bay before 10am"'
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="admin-btn primary" onClick={handleAdd} disabled={saving || !text.trim()}>
          <Plus size={14} />
          {saving ? (isHe ? 'שומר...' : 'Saving...') : (isHe ? 'הוסף הערה' : 'Add note')}
        </button>
      </div>

      {/* AI analyze + filter */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        {isAdmin && (
          <button className="admin-btn primary" onClick={handleAnalyzeWithAI} disabled={openCount === 0}>
            <Wand2 size={14} />
            {isHe ? `נתח ${openCount} הערות עם AI` : `Analyze ${openCount} notes with AI`}
          </button>
        )}
        <button
          className="filter-tab"
          onClick={() => setFilter(filter === 'open' ? 'all' : 'open')}
        >
          {filter === 'open'
            ? (isHe ? 'הצג הכול' : 'Show all')
            : (isHe ? 'הצג פתוחות בלבד' : 'Show open only')}
        </button>
      </div>

      {/* Notes list */}
      {visible.length === 0 ? (
        <div className="empty-state">
          <StickyNote size={48} strokeWidth={1} />
          <p>{isHe ? 'אין הערות עדיין — כל בני המשפחה יכולים להוסיף' : 'No notes yet — anyone in the family can add one'}</p>
        </div>
      ) : (
        visible.map((note) => {
          const cat = catOf(note.category);
          return (
            <div
              key={note.id}
              className="quiz-card"
              style={{ marginBottom: 10, opacity: note.status === 'done' ? 0.55 : 1 }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {cat.emoji} {isHe ? cat.he : cat.en}
                    {note.relatedName ? ` · ${note.relatedName}` : ''}
                    {note.createdByName ? ` · ${note.createdByName}` : ''}
                    {' · '}
                    {new Date(note.createdAt).toLocaleDateString(isHe ? 'he-IL' : 'en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                    {note.status === 'done' && (isHe ? ' · טופל ✓' : ' · handled ✓')}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{note.text}</div>
                </div>
                <button
                  className="admin-icon-btn"
                  onClick={() => toggleStatus(note)}
                  title={
                    note.status === 'open'
                      ? (isHe ? 'סמן כטופל' : 'Mark handled')
                      : (isHe ? 'החזר לפתוח' : 'Reopen')
                  }
                >
                  {note.status === 'open' ? <Check size={15} /> : <RotateCcw size={15} />}
                </button>
                {(isAdmin || note.createdBy === currentMember?.id) && (
                  <button
                    className="admin-icon-btn delete"
                    onClick={() => handleDelete(note)}
                    title={t('common.delete')}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
