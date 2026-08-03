import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Car,
  UtensilsCrossed,
  Star,
  Globe,
  Ticket,
  DoorOpen,
  MapPin,
  Check,
  Pencil,
  Trash2,
  Plus,
  X,
} from 'lucide-react';
import type { PlanItem, TripDay } from '../types/trip';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components -- tiny URL helper shared with plan components
export function gmapsDirUrl(from?: string, to?: string): string {
  const p = new URLSearchParams();
  if (from) p.set('origin', from);
  if (to) p.set('destination', to);
  return `https://www.google.com/maps/dir/?api=1&${p.toString()}`;
}

function fmtDuration(mins?: number, isRTL?: boolean): string {
  if (!mins) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const parts = [h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ');
  return isRTL ? parts.replace('h', ' ש׳').replace('m', ' דק׳') : parts;
}

const KIND_META: Record<PlanItem['kind'], { icon: typeof Star; color: string }> = {
  activity: { icon: Star, color: '#7c3aed' },
  meal: { icon: UtensilsCrossed, color: '#dc2626' },
  drive: { icon: Car, color: '#1d4ed8' },
};

function sortByTime(items: PlanItem[]): PlanItem[] {
  return [...items].sort((a, b) => (a.startTime ?? '99').localeCompare(b.startTime ?? '99'));
}

// ─── Item list with approve/edit/delete/add ──────────────────────────────────

export function PlanItemsList({
  tripDay,
  isRTL,
  isAdmin,
  onSave,
}: {
  tripDay: TripDay;
  isRTL: boolean;
  isAdmin: boolean;
  onSave: (day: TripDay) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const items = sortByTime(tripDay.plan?.items ?? []);

  async function persist(nextItems: PlanItem[]) {
    await onSave({ ...tripDay, plan: { ...(tripDay.plan ?? {}), items: nextItems } });
  }

  async function toggleApproved(item: PlanItem) {
    await persist(items.map((i) => (i.id === item.id ? { ...i, approved: !i.approved } : i)));
  }

  async function remove(item: PlanItem) {
    if (!window.confirm(isRTL ? 'למחוק את הפריט?' : 'Delete this item?')) return;
    await persist(items.filter((i) => i.id !== item.id));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item) => {
        const meta = KIND_META[item.kind] ?? KIND_META.activity;
        const Icon = meta.icon;
        const name = isRTL ? item.nameHe || item.name : item.name;
        const notes = isRTL ? item.notesHe || item.notes : item.notes;
        if (editingId === item.id) {
          return (
            <PlanItemForm
              key={item.id}
              initial={item}
              isRTL={isRTL}
              onCancel={() => setEditingId(null)}
              onSubmit={async (updated) => {
                await persist(items.map((i) => (i.id === item.id ? updated : i)));
                setEditingId(null);
              }}
            />
          );
        }
        return (
          <div
            key={item.id}
            style={{
              border: `1px solid ${item.approved ? meta.color : 'var(--border-color, #e5e7eb)'}`,
              borderRadius: 10,
              padding: '8px 10px',
              opacity: item.approved === false ? 0.9 : 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Icon size={15} color={meta.color} />
              {item.startTime && (
                <span style={{ fontSize: 12, fontWeight: 700 }}>
                  <Clock size={11} /> {item.startTime}
                </span>
              )}
              <span style={{ fontWeight: 600, flex: 1, minWidth: 120 }}>{name}</span>
              {item.approved && (
                <span style={{ fontSize: 11, color: meta.color, fontWeight: 700 }}>
                  ✓ {isRTL ? 'מאושר' : 'approved'}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {item.durationMinutes ? <span>⏱ {fmtDuration(item.durationMinutes, isRTL)}</span> : null}
              {item.kind === 'drive' && item.distanceKm ? <span>{item.distanceKm} km</span> : null}
              {item.location && item.kind !== 'drive' ? <span><MapPin size={11} /> {item.location}</span> : null}
              {item.kind === 'drive' && (item.from || item.to) ? <span>{item.from} ← {item.to}</span> : null}
              {item.price && <span><Ticket size={11} /> {item.price}</span>}
              {item.openingHours && <span><DoorOpen size={11} /> {item.openingHours}</span>}
              {item.website && (
                <a href={item.website} target="_blank" rel="noreferrer" style={{ color: 'var(--blue-600, #2563eb)' }}>
                  <Globe size={11} /> {isRTL ? 'אתר' : 'website'}
                </a>
              )}
            </div>
            {notes && <div style={{ fontSize: 12, marginTop: 4 }}>{notes}</div>}
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {item.kind === 'drive' ? (
                <a
                  className="admin-btn secondary"
                  style={{ fontSize: 12, textDecoration: 'none' }}
                  href={gmapsDirUrl(item.from, item.to)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Car size={12} /> {isRTL ? 'ניווט במפות' : 'Open directions'}
                </a>
              ) : (
                (item.lat || item.location) && (
                  <button
                    className="admin-btn secondary"
                    style={{ fontSize: 12 }}
                    onClick={() =>
                      navigate(
                        item.lat && item.lng
                          ? `/map?focus=${item.lat},${item.lng}&label=${encodeURIComponent(name)}`
                          : `/map?focusName=${encodeURIComponent(item.location ?? name)}&label=${encodeURIComponent(name)}`
                      )
                    }
                  >
                    <MapPin size={12} /> {isRTL ? 'הצג במפה' : 'Show on map'}
                  </button>
                )
              )}
              {isAdmin && (
                <>
                  <button
                    className="admin-btn secondary"
                    style={{ fontSize: 12, ...(item.approved ? {} : { borderColor: meta.color, color: meta.color }) }}
                    onClick={() => toggleApproved(item)}
                  >
                    {item.approved ? <X size={12} /> : <Check size={12} />}
                    {item.approved ? (isRTL ? 'בטל אישור' : 'Unapprove') : (isRTL ? 'אשר' : 'Approve')}
                  </button>
                  <button className="admin-icon-btn" onClick={() => setEditingId(item.id)} title={isRTL ? 'עריכה' : 'Edit'}>
                    <Pencil size={13} />
                  </button>
                  <button className="admin-icon-btn delete" onClick={() => remove(item)} title={isRTL ? 'מחיקה' : 'Delete'}>
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}

      {isAdmin &&
        (adding ? (
          <PlanItemForm
            isRTL={isRTL}
            onCancel={() => setAdding(false)}
            onSubmit={async (item) => {
              await persist([...items, item]);
              setAdding(false);
            }}
          />
        ) : (
          <button className="admin-btn secondary" style={{ fontSize: 12 }} onClick={() => setAdding(true)}>
            <Plus size={12} /> {isRTL ? 'הוסף פריט' : 'Add item'}
          </button>
        ))}
    </div>
  );
}

// ─── Add / edit form ──────────────────────────────────────────────────────────

function PlanItemForm({
  initial,
  isRTL,
  onSubmit,
  onCancel,
}: {
  initial?: PlanItem;
  isRTL: boolean;
  onSubmit: (item: PlanItem) => Promise<void>;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<PlanItem['kind']>(initial?.kind ?? 'activity');
  const [name, setName] = useState(isRTL ? initial?.nameHe || initial?.name || '' : initial?.name ?? '');
  const [startTime, setStartTime] = useState(initial?.startTime ?? '');
  const [duration, setDuration] = useState(initial?.durationMinutes ? String(initial.durationMinutes) : '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [from, setFrom] = useState(initial?.from ?? '');
  const [to, setTo] = useState(initial?.to ?? '');
  const [website, setWebsite] = useState(initial?.website ?? '');
  const [price, setPrice] = useState(initial?.price ?? '');
  const [hours, setHours] = useState(initial?.openingHours ?? '');
  const [notes, setNotes] = useState(isRTL ? initial?.notesHe || initial?.notes || '' : initial?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const input = (v: string, set: (x: string) => void, placeholder: string, type = 'text') => (
    <input className="setup-input" style={{ flex: 1, minWidth: 110 }} type={type} value={v} placeholder={placeholder} onChange={(e) => set(e.target.value)} />
  );

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        ...(initial ?? {}),
        id: initial?.id ?? `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind,
        name: isRTL ? initial?.name || name.trim() : name.trim(),
        nameHe: isRTL ? name.trim() : initial?.nameHe,
        startTime: startTime || undefined,
        durationMinutes: duration ? Number(duration) : undefined,
        location: location || undefined,
        from: kind === 'drive' ? from || undefined : undefined,
        to: kind === 'drive' ? to || undefined : undefined,
        website: website || undefined,
        price: price || undefined,
        openingHours: hours || undefined,
        notes: isRTL ? initial?.notes : notes || undefined,
        notesHe: isRTL ? notes || undefined : initial?.notesHe,
        approved: initial?.approved ?? false,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ border: '1px dashed var(--border-color, #cbd5e1)', borderRadius: 10, padding: 10 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {(['activity', 'meal', 'drive'] as const).map((k) => (
          <button key={k} className={`filter-tab ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)}>
            {k === 'activity' ? (isRTL ? '⭐ פעילות' : '⭐ Activity') : k === 'meal' ? (isRTL ? '🍽️ ארוחה' : '🍽️ Meal') : (isRTL ? '🚗 נסיעה' : '🚗 Drive')}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        {input(name, setName, isRTL ? 'שם' : 'Name')}
        {input(startTime, setStartTime, isRTL ? 'שעה' : 'Time', 'time')}
        {input(duration, setDuration, isRTL ? 'משך (דקות)' : 'Duration (min)', 'number')}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        {kind === 'drive' ? (
          <>
            {input(from, setFrom, isRTL ? 'מ־' : 'From')}
            {input(to, setTo, isRTL ? 'אל' : 'To')}
          </>
        ) : (
          <>
            {input(location, setLocation, isRTL ? 'מיקום' : 'Location')}
            {input(website, setWebsite, isRTL ? 'אתר (URL)' : 'Website (URL)')}
            {input(price, setPrice, isRTL ? 'מחיר' : 'Price')}
            {input(hours, setHours, isRTL ? 'שעות פתיחה' : 'Opening hours')}
          </>
        )}
      </div>
      <textarea className="setup-input" style={{ width: '100%', minHeight: 40, marginBottom: 8 }} placeholder={isRTL ? 'הערות' : 'Notes'} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="admin-btn primary" onClick={submit} disabled={saving || !name.trim()}>
          {saving ? (isRTL ? 'שומר...' : 'Saving...') : (isRTL ? 'שמירה' : 'Save')}
        </button>
        <button className="admin-btn secondary" onClick={onCancel}>{isRTL ? 'ביטול' : 'Cancel'}</button>
      </div>
    </div>
  );
}

// ─── Pre-generation questionnaire ────────────────────────────────────────────

export interface PlanPreferences {
  interests: string[];
  pace: 'relaxed' | 'balanced' | 'packed';
  budget: 'budget' | 'moderate' | 'splurge';
  meals: 'restaurants' | 'mixed' | 'self';
  kidsAges: string;
  extra: string;
}

const INTERESTS = [
  { key: 'nature', en: 'Nature & hikes', he: 'טבע וטיולים' },
  { key: 'beaches', en: 'Beaches & water', he: 'חופים ומים' },
  { key: 'history', en: 'History & old towns', he: 'היסטוריה וערים עתיקות' },
  { key: 'kids-fun', en: 'Kids attractions', he: 'אטרקציות לילדים' },
  { key: 'food', en: 'Food experiences', he: 'חוויות אוכל' },
  { key: 'scenic-drives', en: 'Scenic drives', he: 'נופים מהאוטו' },
];

export function PlanQuestionnaire({
  isRTL,
  defaultKidsAges,
  onCancel,
  onSubmit,
}: {
  isRTL: boolean;
  defaultKidsAges?: string;
  onCancel: () => void;
  onSubmit: (prefs: PlanPreferences) => void;
}) {
  const [interests, setInterests] = useState<string[]>(['nature', 'kids-fun']);
  const [pace, setPace] = useState<PlanPreferences['pace']>('balanced');
  const [budget, setBudget] = useState<PlanPreferences['budget']>('moderate');
  const [meals, setMeals] = useState<PlanPreferences['meals']>('mixed');
  const [kidsAges, setKidsAges] = useState(defaultKidsAges ?? '');
  const [extra, setExtra] = useState('');

  const row = (label: string, children: React.ReactNode) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
  const chip = (active: boolean, label: string, onClick: () => void) => (
    <button key={label} className={`filter-tab ${active ? 'active' : ''}`} onClick={onClick}>
      {label}
    </button>
  );

  return (
    <div className="quiz-card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>{isRTL ? 'כמה שאלות לפני שנבנה תוכנית 👇' : 'A few questions before we build the plan 👇'}</h3>
      {row(
        isRTL ? 'מה מעניין אתכם? (אפשר כמה)' : 'What interests you? (pick several)',
        INTERESTS.map((i) =>
          chip(interests.includes(i.key), isRTL ? i.he : i.en, () =>
            setInterests((prev) => (prev.includes(i.key) ? prev.filter((x) => x !== i.key) : [...prev, i.key]))
          )
        )
      )}
      {row(isRTL ? 'קצב' : 'Pace', [
        chip(pace === 'relaxed', isRTL ? 'רגוע' : 'Relaxed', () => setPace('relaxed')),
        chip(pace === 'balanced', isRTL ? 'מאוזן' : 'Balanced', () => setPace('balanced')),
        chip(pace === 'packed', isRTL ? 'עמוס' : 'Packed', () => setPace('packed')),
      ])}
      {row(isRTL ? 'תקציב' : 'Budget', [
        chip(budget === 'budget', isRTL ? 'חסכוני' : 'Budget', () => setBudget('budget')),
        chip(budget === 'moderate', isRTL ? 'בינוני' : 'Moderate', () => setBudget('moderate')),
        chip(budget === 'splurge', isRTL ? 'מפנקים' : 'Splurge', () => setBudget('splurge')),
      ])}
      {row(isRTL ? 'ארוחות' : 'Meals', [
        chip(meals === 'restaurants', isRTL ? 'מסעדות' : 'Restaurants', () => setMeals('restaurants')),
        chip(meals === 'mixed', isRTL ? 'משולב' : 'Mixed', () => setMeals('mixed')),
        chip(meals === 'self', isRTL ? 'בישול עצמי/פיקניק' : 'Self-catering/picnic', () => setMeals('self')),
      ])}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{isRTL ? 'גילאי הילדים' : 'Kids ages'}</div>
        <input className="setup-input" style={{ width: '100%' }} placeholder={isRTL ? 'למשל: 4, 8, 11, 14' : 'e.g. 4, 8, 11, 14'} value={kidsAges} onChange={(e) => setKidsAges(e.target.value)} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{isRTL ? 'עוד משהו שחשוב שנדע?' : 'Anything else we should know?'}</div>
        <textarea className="setup-input" style={{ width: '100%', minHeight: 50 }} placeholder={isRTL ? 'העדפות, מגבלות, מקומות שחובה לבקר...' : 'Preferences, constraints, must-see places...'} value={extra} onChange={(e) => setExtra(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="admin-btn primary" onClick={() => onSubmit({ interests, pace, budget, meals, kidsAges, extra })}>
          {isRTL ? 'בנה תוכנית' : 'Build the plan'}
        </button>
        <button className="admin-btn secondary" onClick={onCancel}>{isRTL ? 'ביטול' : 'Cancel'}</button>
      </div>
    </div>
  );
}
