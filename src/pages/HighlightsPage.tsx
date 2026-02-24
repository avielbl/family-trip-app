import React, { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Clock, Ticket, CheckCircle, Circle, ExternalLink, Plus, Pencil, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTripContext } from '../context/TripContext';
import { toggleHighlightComplete, saveHighlight, deleteHighlight } from '../firebase/tripService';
import type { Highlight, HighlightCategory } from '../types/trip';

const CATEGORY_EMOJIS: Record<HighlightCategory, string> = {
  beach: '🏖️',
  ruins: '🏛️',
  museum: '🏺',
  food: '🍽️',
  'kids-fun': '🎡',
  nature: '🌿',
  shopping: '🛍️',
  viewpoint: '🌅',
  other: '📌',
};

const ALL_CATEGORIES: HighlightCategory[] = [
  'beach', 'ruins', 'museum', 'food', 'kids-fun', 'nature', 'shopping', 'viewpoint', 'other',
];

function emptyHighlight(dayIndex = 0): Highlight {
  return {
    id: `hl-${Date.now()}`,
    dayIndex,
    name: '',
    category: 'other',
    completed: false,
    completedBy: [],
  };
}

const HighlightsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { highlights, tripCode, currentMember, days, config, isAdmin } = useTripContext();
  const [selectedCategory, setSelectedCategory] = useState<HighlightCategory | 'all'>('all');
  const [editItem, setEditItem] = useState<Highlight | null>(null);
  const [showModal, setShowModal] = useState(false);

  const isHebrew = i18n.language === 'he';

  const getHighlightName = (h: Highlight) => (isHebrew && h.nameHe ? h.nameHe : h.name);
  const getHighlightDescription = (h: Highlight) => (isHebrew && h.descriptionHe ? h.descriptionHe : h.description);

  const getMapUrl = (h: Highlight) => {
    if (h.mapUrl) return h.mapUrl;
    if (h.address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.address)}`;
    return null;
  };

  const filteredHighlights = useMemo(() => {
    if (selectedCategory === 'all') return highlights;
    return highlights.filter((h) => h.category === selectedCategory);
  }, [highlights, selectedCategory]);

  const highlightsByDay = useMemo(() => {
    const grouped = new Map<number, Highlight[]>();
    const sorted = [...filteredHighlights].sort((a, b) => a.dayIndex - b.dayIndex);
    for (const h of sorted) {
      const existing = grouped.get(h.dayIndex) || [];
      existing.push(h);
      grouped.set(h.dayIndex, existing);
    }
    return grouped;
  }, [filteredHighlights]);

  const getDayLabel = (dayIndex: number) => {
    const day = days.find((d) => d.dayIndex === dayIndex);
    if (day) {
      try { return `${t('common.day')} ${dayIndex + 1} - ${format(parseISO(day.date), 'MMM d')}`; }
      catch { return `${t('common.day')} ${dayIndex + 1}`; }
    }
    return `${t('common.day')} ${dayIndex + 1}`;
  };

  const handleToggleComplete = useCallback(async (h: Highlight) => {
    if (!tripCode || !currentMember) return;
    const isCompletedByMe = h.completedBy?.includes(currentMember.id) ?? false;
    await toggleHighlightComplete(tripCode, h.id, currentMember.id, !isCompletedByMe);
  }, [tripCode, currentMember]);

  const getMemberName = (memberId: string) => {
    const member = config?.familyMembers.find((m) => m.id === memberId);
    if (!member) return memberId;
    return isHebrew ? member.nameHe : member.name;
  };

  async function handleSave(h: Highlight) {
    if (!tripCode) return;
    await saveHighlight(tripCode, h);
    setShowModal(false);
    setEditItem(null);
  }

  async function handleDelete(id: string) {
    if (!tripCode) return;
    if (!confirm(isHebrew ? 'למחוק אטרקציה זו?' : 'Delete this highlight?')) return;
    await deleteHighlight(tripCode, id);
  }

  return (
    <div className="highlights-page">
      <h1 className="page-title">{t('highlights.title')}</h1>

      {isAdmin && (
        <div className="admin-add-bar">
          <button
            className="admin-icon-btn add"
            onClick={() => { setEditItem(emptyHighlight()); setShowModal(true); }}
          >
            <Plus size={14} /> {isHebrew ? 'הוסף אטרקציה' : 'Add Highlight'}
          </button>
        </div>
      )}

      <div className="category-filter">
        <button
          className={`category-tab ${selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('all')}
        >
          {t('highlights.allCategories')}
        </button>
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`category-tab ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {CATEGORY_EMOJIS[cat]} {t(`highlights.categories.${cat}`)}
          </button>
        ))}
      </div>

      {Array.from(highlightsByDay.entries()).map(([dayIndex, dayHighlights]) => (
        <div key={dayIndex} className="highlights-day-group">
          <h3 className="day-header">{getDayLabel(dayIndex)}</h3>

          {dayHighlights.map((h) => {
            const isCompletedByMe = currentMember && h.completedBy?.includes(currentMember.id);
            const mapUrl = getMapUrl(h);

            return (
              <div
                key={h.id}
                className={`highlight-card ${h.completed ? 'highlight-completed' : ''}`}
              >
                {h.imageUrl && (
                  <img src={h.imageUrl} alt={getHighlightName(h)} loading="lazy" style={{ width: '100%', borderRadius: '8px', marginBottom: '8px' }} />
                )}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span className="highlight-emoji">{CATEGORY_EMOJIS[h.category]}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>{getHighlightName(h)}</div>
                    {getHighlightDescription(h) && (
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>{getHighlightDescription(h)}</p>
                    )}
                    {h.openingHours && (
                      <div className="card-detail"><Clock size={13} /> {t('highlights.openingHours')}: {h.openingHours}</div>
                    )}
                    {h.ticketInfo && (
                      <div className="card-detail"><Ticket size={13} /> {t('highlights.tickets')}: {h.ticketInfo}</div>
                    )}
                    {h.address && (
                      <div className="card-detail">
                        <MapPin size={13} /> {h.address}
                        {mapUrl && (
                          <a href={mapUrl} target="_blank" rel="noopener noreferrer" style={{ marginInlineStart: '4px', color: 'var(--brand-primary)' }}>
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    )}
                    {h.completedBy && h.completedBy.length > 0 && (
                      <div className="card-detail" style={{ color: 'var(--green-600)' }}>
                        <CheckCircle size={13} /> {t('highlights.visited')}: {h.completedBy.map(getMemberName).join(', ')}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                      <button
                        className={`visit-btn ${isCompletedByMe ? 'done' : 'not-done'}`}
                        onClick={() => handleToggleComplete(h)}
                      >
                        {isCompletedByMe ? (
                          <><CheckCircle size={14} /> {t('highlights.markUndone')}</>
                        ) : (
                          <><Circle size={14} /> {t('highlights.markDone')}</>
                        )}
                      </button>
                      {isAdmin && (
                        <>
                          <button className="admin-icon-btn edit" onClick={() => { setEditItem(h); setShowModal(true); }}>
                            <Pencil size={13} /> {t('common.edit')}
                          </button>
                          <button className="admin-icon-btn delete" onClick={() => handleDelete(h.id)}>
                            <Trash2 size={13} /> {t('common.delete')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Edit/Add Modal */}
      {showModal && editItem && (
        <HighlightModal
          highlight={editItem}
          days={days}
          isHe={isHebrew}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditItem(null); }}
          t={t}
        />
      )}
    </div>
  );
};

function HighlightModal({
  highlight,
  days,
  isHe,
  onSave,
  onClose,
  t,
}: {
  highlight: Highlight;
  days: { dayIndex: number; date: string; title: string }[];
  isHe: boolean;
  onSave: (h: Highlight) => void;
  onClose: () => void;
  t: (key: string) => string;
}) {
  const [form, setForm] = useState({ ...highlight });

  function set(field: keyof Highlight, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          {isHe ? (highlight.name ? 'ערוך אטרקציה' : 'הוסף אטרקציה') : (highlight.name ? 'Edit Highlight' : 'Add Highlight')}
        </div>

        <div className="form-group">
          <label className="form-label">{isHe ? 'שם' : 'Name'}</label>
          <input className="form-input" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">{isHe ? 'שם בעברית' : 'Name (Hebrew)'}</label>
          <input className="form-input" dir="rtl" value={form.nameHe ?? ''} onChange={(e) => set('nameHe', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">{isHe ? 'תיאור' : 'Description'}</label>
          <textarea className="form-input" value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} rows={2} />
        </div>
        <div className="form-group">
          <label className="form-label">{isHe ? 'קטגוריה' : 'Category'}</label>
          <select className="form-input" value={form.category} onChange={(e) => set('category', e.target.value as HighlightCategory)}>
            {(['beach','ruins','museum','food','kids-fun','nature','shopping','viewpoint','other'] as HighlightCategory[]).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{isHe ? 'יום' : 'Day'}</label>
          <select className="form-input" value={form.dayIndex} onChange={(e) => set('dayIndex', Number(e.target.value))}>
            {days.map((d) => (
              <option key={d.dayIndex} value={d.dayIndex}>{t('common.day')} {d.dayIndex + 1} — {d.title}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{isHe ? 'כתובת' : 'Address'}</label>
          <input className="form-input" value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">{isHe ? 'שעות פתיחה' : 'Opening Hours'}</label>
          <input className="form-input" value={form.openingHours ?? ''} onChange={(e) => set('openingHours', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">{isHe ? 'מידע על כרטיסים' : 'Ticket Info'}</label>
          <input className="form-input" value={form.ticketInfo ?? ''} onChange={(e) => set('ticketInfo', e.target.value)} />
        </div>

        <div className="modal-actions">
          <button className="admin-btn secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button className="admin-btn primary" onClick={() => onSave(form)}>{t('common.save')}</button>
        </div>
      </div>
    </div>
  );
}

export default HighlightsPage;
