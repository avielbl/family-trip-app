import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, X, MessageCircle, Check, XCircle } from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import { callAI, buildChatSystemPrompt, aiErrorMessage } from '../firebase/aiService';
import { saveHighlight, saveRestaurant, saveDrivingSegment, deleteHighlight, deleteRestaurant, deleteDrivingSegment, saveTripDay } from '../firebase/tripService';
import type { Highlight, Restaurant, DrivingSegment } from '../types/trip';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * SECURITY: Only these action types are allowed. Any action type returned by the
 * AI that is NOT in this list is silently dropped before being shown to the user.
 */
const ALLOWED_ACTION_TYPES = [
  'add_highlight',
  'add_restaurant',
  'add_driving_route',
  'add_weather_location',
  'delete_highlight',
  'delete_restaurant',
  'delete_driving_route',
  'update_trip_day',
] as const;

type ChatActionType = (typeof ALLOWED_ACTION_TYPES)[number];

interface ChatAction {
  id: string;
  type: ChatActionType;
  data: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'dismissed';
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions: ChatAction[];
  error?: string;
}

const ACTION_LABELS: Record<ChatActionType, { en: string; he: string }> = {
  add_highlight:         { en: 'Add Attraction',       he: 'הוספת אטרקציה' },
  add_restaurant:        { en: 'Add Restaurant',       he: 'הוספת מסעדה' },
  add_driving_route:     { en: 'Add Driving Route',    he: 'הוספת מסלול נסיעה' },
  add_weather_location:  { en: 'Add Weather Location', he: 'הוספת מיקום מזג אוויר' },
  delete_highlight:      { en: 'Delete Attraction',    he: 'מחיקת אטרקציה' },
  delete_restaurant:     { en: 'Delete Restaurant',    he: 'מחיקת מסעדה' },
  delete_driving_route:  { en: 'Delete Driving Route', he: 'מחיקת מסלול נסיעה' },
  update_trip_day:       { en: 'Update Day',           he: 'עדכון יום' },
};

/** Max characters a user message can be (prevents prompt injection via very long input). */
const MAX_INPUT_LENGTH = 800;

// ─── Action parser ────────────────────────────────────────────────────────────

/** Strip accidental JSON object wrappers: {"response":"..."} → plain text */
function unwrapJsonObject(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^\{[\s\S]*?"(?:response|answer|text|message|content|reply)"\s*:\s*"([\s\S]+?)"[\s\S]*?\}$/);
  if (match) {
    try { return JSON.parse(`"${match[1]}"`); } catch { return match[1]; }
  }
  return text;
}

/**
 * Parse AI response — handles two formats:
 * 1. XML-style: <action type="add_highlight">{...}</action>  (preferred)
 * 2. JSON array: [{"action":"add_highlight","data":{...}}, ...]  (fallback when AI ignores tag format)
 */
function parseActions(rawText: string): { cleanText: string; actions: Omit<ChatAction, 'status'>[] } {
  const actions: Omit<ChatAction, 'status'>[] = [];

  // ── Try JSON array format first ────────────────────────────────────────────
  const trimmed = rawText.trim();
  // Strip markdown code fence if present
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
  const jsonCandidate = fenced ? fenced[1].trim() : trimmed;

  if (jsonCandidate.startsWith('[')) {
    try {
      const arr = JSON.parse(jsonCandidate);
      if (Array.isArray(arr) && arr.length > 0 && typeof arr[0].action === 'string') {
        arr.forEach((item: { action: string; data?: Record<string, unknown> }, i: number) => {
          const type = item.action as ChatActionType;
          // SECURITY: whitelist check
          if (!ALLOWED_ACTION_TYPES.includes(type)) return;
          const data = item.data ?? {};
          if (typeof data !== 'object' || Array.isArray(data)) return;
          actions.push({ id: `action-${Date.now()}-${i}`, type, data });
        });
        // No surrounding text when AI returned only JSON
        return { cleanText: '', actions };
      }
    } catch { /* not valid JSON, fall through to XML tag parsing */ }
  }

  // ── Parse XML-style <action> tags ─────────────────────────────────────────
  const cleanText = unwrapJsonObject(rawText)
    .replace(/<action type="([^"]{0,64})">([\s\S]*?)<\/action>/g, (_, type, json) => {
      if (!ALLOWED_ACTION_TYPES.includes(type as ChatActionType)) return '';
      try {
        const data = JSON.parse(json.trim());
        if (typeof data !== 'object' || Array.isArray(data) || data === null) return '';
        actions.push({
          id: `action-${Date.now()}-${actions.length}`,
          type: type as ChatActionType,
          data,
        });
      } catch {}
      return '';
    })
    .trim();

  return { cleanText, actions };
}

// ─── Data sanitizers — strip unsafe input before saving to Firestore ──────────

function sanitizeString(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val.slice(0, 500).trim();
  return fallback;
}

function sanitizeNumber(val: unknown, fallback = 0): number {
  const n = Number(val);
  return isFinite(n) ? Math.max(0, Math.min(n, 99999)) : fallback;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TripChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { i18n } = useTranslation();
  const {
    tripCode, config, hotels, days, highlights, restaurants, driving, isAdmin,
  } = useTripContext();
  const isRTL = i18n.language === 'he';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Add welcome message on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: isRTL
          ? 'שלום! אני עוזר הטיול של TripIt 🏛️\nאני יכול לענות על שאלות על יוון, להמליץ על אטרקציות ומסעדות, ולעזור לתכנן מסלולים. מה תרצה לדעת?'
          : 'Hi! I\'m TripIt\'s AI travel assistant 🏛️\nI can answer questions about Greece, recommend attractions and restaurants, and help plan routes. What would you like to know?',
        actions: [],
      }]);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || sending) return;

    // SECURITY: truncate to max length before sending to AI
    const userText = input.trim().slice(0, MAX_INPUT_LENGTH);
    setInput('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userText,
      actions: [],
    };
    const loadingId = `loading-${Date.now()}`;
    const loadingMsg: ChatMessage = { id: loadingId, role: 'assistant', content: '...', actions: [] };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setSending(true);

    try {
      const systemPrompt = buildChatSystemPrompt({
        hotels,
        days,
        highlights,
        restaurants,
        driving,
        isAdmin,
        startDate: config?.startDate ?? '2026-03-24',
        endDate: config?.endDate ?? '2026-04-04',
        language: isRTL ? 'he' : 'en',
      });

      // Build conversation history (skip welcome + loading msgs)
      const history = messages
        .filter((m) => m.id !== 'welcome' && !m.id.startsWith('loading'))
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');

      const fullPrompt = `${systemPrompt}${history ? `${history}\n` : ''}User: ${userText}`;
      const raw = await callAI(fullPrompt);
      const { cleanText, actions } = parseActions(raw);

      // SECURITY: for non-admin users, drop all content-modifying actions
      const safeActions = actions.filter((a) =>
        isAdmin || a.type === 'add_weather_location'
      );

      // When AI returned only JSON (no text), generate a summary line
      const addCount = safeActions.filter((a) => a.type.startsWith('add_')).length;
      const delCount = safeActions.filter((a) => a.type.startsWith('delete_')).length;
      const autoSummary = !cleanText && safeActions.length > 0
        ? (isRTL
            ? `מצאתי ${safeActions.length} פעולות לביצוע${addCount ? ` (${addCount} הוספות)` : ''}${delCount ? ` (${delCount} מחיקות)` : ''}. אשר כל פעולה:`
            : `Found ${safeActions.length} action${safeActions.length > 1 ? 's' : ''} to perform${addCount ? ` (${addCount} add)` : ''}${delCount ? ` (${delCount} delete)` : ''}. Confirm each:`)
        : '';

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== loadingId),
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: cleanText || autoSummary || '…',
          actions: safeActions.map((a) => ({ ...a, status: 'pending' as const })),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== loadingId),
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: '',
          actions: [],
          error: aiErrorMessage(err, isRTL),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function acceptAction(msgId: string, actionId: string) {
    const msg = messages.find((m) => m.id === msgId);
    const action = msg?.actions.find((a) => a.id === actionId);
    if (!action || !tripCode) return;

    // SECURITY: re-validate admin for content actions at execution time
    const requiresAdmin = action.type !== 'add_weather_location';
    if (requiresAdmin && !isAdmin) return;

    try {
      if (action.type === 'add_highlight') {
        const h: Highlight = {
          id: `hl-chat-${Date.now()}`,
          dayIndex: sanitizeNumber(action.data.dayIndex, 0),
          name: sanitizeString(action.data.name) || 'New Attraction',
          nameHe: sanitizeString(action.data.nameHe),
          description: sanitizeString(action.data.description),
          descriptionHe: '',
          category: ((['beach','ruins','museum','food','kids-fun','nature','shopping','viewpoint','other'] as const)
            .includes(action.data.category as Highlight['category'])
              ? action.data.category
              : 'other') as Highlight['category'],
          address: sanitizeString(action.data.address),
          openingHours: '',
          ticketInfo: '',
          mapUrl: '',
          lat: typeof action.data.lat === 'number' ? action.data.lat : undefined,
          lng: typeof action.data.lng === 'number' ? action.data.lng : undefined,
          completed: false,
          completedBy: [],
          imageUrl: '',
        };
        await saveHighlight(tripCode, h);

      } else if (action.type === 'add_restaurant') {
        const r: Restaurant = {
          id: `rest-chat-${Date.now()}`,
          dayIndex: sanitizeNumber(action.data.dayIndex, 0),
          name: sanitizeString(action.data.name) || 'New Restaurant',
          nameHe: sanitizeString(action.data.nameHe),
          cuisine: sanitizeString(action.data.cuisine),
          address: sanitizeString(action.data.address),
          city: sanitizeString(action.data.city),
          phone: '',
          mapUrl: '',
          lat: typeof action.data.lat === 'number' ? action.data.lat : undefined,
          lng: typeof action.data.lng === 'number' ? action.data.lng : undefined,
          priceRange: (['$', '$$', '$$$'].includes(action.data.priceRange as string)
            ? action.data.priceRange
            : '$$') as Restaurant['priceRange'],
          ratings: {},
          notes: sanitizeString(action.data.notes),
          visited: false,
        };
        await saveRestaurant(tripCode, r);

      } else if (action.type === 'add_driving_route') {
        const d: DrivingSegment = {
          id: `drv-chat-${Date.now()}`,
          dayIndex: sanitizeNumber(action.data.dayIndex, 0),
          from: sanitizeString(action.data.from) || 'From',
          to: sanitizeString(action.data.to) || 'To',
          distanceKm: sanitizeNumber(action.data.distanceKm, 0),
          durationMinutes: sanitizeNumber(action.data.durationMinutes, 0),
          mapUrl: '',
          notes: sanitizeString(action.data.notes),
        };
        await saveDrivingSegment(tripCode, d);

      } else if (action.type === 'delete_highlight') {
        const id = sanitizeString(action.data.id);
        // SECURITY: verify item actually exists before deleting
        if (!id || !highlights.find((h) => h.id === id)) return;
        await deleteHighlight(tripCode, id);

      } else if (action.type === 'delete_restaurant') {
        const id = sanitizeString(action.data.id);
        if (!id || !restaurants.find((r) => r.id === id)) return;
        await deleteRestaurant(tripCode, id);

      } else if (action.type === 'delete_driving_route') {
        const id = sanitizeString(action.data.id);
        if (!id || !driving.find((d) => d.id === id)) return;
        await deleteDrivingSegment(tripCode, id);

      } else if (action.type === 'update_trip_day') {
        const dayIndex = sanitizeNumber(action.data.dayIndex, -1);
        if (dayIndex < 0) return;
        // Merge over existing day or create new entry
        const existing = days.find((d) => d.dayIndex === dayIndex);
        const updated = {
          dayIndex,
          date: sanitizeString(action.data.date ?? existing?.date ?? ''),
          title: sanitizeString(action.data.title ?? existing?.title ?? ''),
          titleHe: sanitizeString(action.data.titleHe ?? existing?.titleHe ?? ''),
          location: sanitizeString(action.data.location ?? existing?.location ?? ''),
          locationHe: sanitizeString(action.data.locationHe ?? existing?.locationHe ?? ''),
        };
        await saveTripDay(tripCode, updated as import('../types/trip').TripDay);

      } else if (action.type === 'add_weather_location') {
        const city = sanitizeString(action.data.city);
        if (!city) return;
        const lat = typeof action.data.lat === 'number' ? action.data.lat : undefined;
        const lng = typeof action.data.lng === 'number' ? action.data.lng : undefined;
        const existing: Array<{ city: string; lat?: number; lng?: number }> =
          JSON.parse(localStorage.getItem('weatherExtraLocations') ?? '[]');
        if (!existing.find((e) => e.city.toLowerCase() === city.toLowerCase())) {
          existing.push({ city, lat, lng });
          localStorage.setItem('weatherExtraLocations', JSON.stringify(existing));
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, actions: m.actions.map((a) => a.id === actionId ? { ...a, status: 'accepted' as const } : a) }
            : m
        )
      );
    } catch (err) {
      console.error('Chat action failed:', err);
    }
  }

  function dismissAction(msgId: string, actionId: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? { ...m, actions: m.actions.map((a) => a.id === actionId ? { ...a, status: 'dismissed' as const } : a) }
          : m
      )
    );
  }

  if (!open) return null;

  return (
    <div className="chat-overlay" onClick={onClose}>
      <div
        className={`chat-panel ${isRTL ? 'chat-panel-rtl' : ''}`}
        onClick={(e) => e.stopPropagation()}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-info">
            <MessageCircle size={18} />
            <span>{isRTL ? 'עוזר טיול AI' : 'TripIt AI Assistant'}</span>
          </div>
          <button className="chat-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`chat-message chat-message-${msg.role}`}>
              {msg.error ? (
                <div className="chat-error-bubble">{msg.error}</div>
              ) : (
                <div className="chat-bubble">
                  {msg.content === '...' ? (
                    <div className="chat-typing">
                      <span /><span /><span />
                    </div>
                  ) : (
                    <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{msg.content}</p>
                  )}
                </div>
              )}

              {/* Action cards */}
              {msg.actions.map((action) => (
                <div key={action.id} className={`chat-action chat-action-${action.status} ${action.type.startsWith('delete_') ? 'chat-action-danger' : action.type === 'update_trip_day' ? 'chat-action-update' : ''}`}>
                  <div className="chat-action-label">
                    {ACTION_LABELS[action.type][isRTL ? 'he' : 'en']}
                  </div>
                  <div className="chat-action-name">
                    {action.type === 'update_trip_day'
                      ? `Day ${(action.data.dayIndex as number ?? 0) + 1}: ${sanitizeString(action.data.location ?? action.data.title, '?')}`
                      : sanitizeString(action.data.name ?? action.data.city ?? action.data.from, '?')}
                    {action.type !== 'update_trip_day' && action.data.to ? ` → ${sanitizeString(action.data.to)}` : ''}
                  </div>
                  {action.status === 'pending' && (
                    <div className="chat-action-buttons">
                      <button
                        className={action.type.startsWith('delete_') ? 'chat-action-delete' : 'chat-action-accept'}
                        onClick={() => acceptAction(msg.id, action.id)}
                      >
                        <Check size={14} />
                        {action.type.startsWith('delete_')
                          ? (isRTL ? 'מחק' : 'Delete')
                          : action.type === 'update_trip_day'
                            ? (isRTL ? 'עדכן' : 'Update')
                            : (isRTL ? 'הוסף' : 'Add')}
                      </button>
                      <button
                        className="chat-action-dismiss"
                        onClick={() => dismissAction(msg.id, action.id)}
                      >
                        <XCircle size={14} />
                        {isRTL ? 'ביטול' : 'Cancel'}
                      </button>
                    </div>
                  )}
                  {action.status === 'accepted' && (
                    <div className={`chat-action-status ${action.type.startsWith('delete_') ? 'deleted' : 'accepted'}`}>
                      ✓ {action.type.startsWith('delete_')
                        ? (isRTL ? 'נמחק' : 'Deleted!')
                        : action.type === 'update_trip_day'
                          ? (isRTL ? 'עודכן' : 'Updated!')
                          : (isRTL ? 'נוסף בהצלחה' : 'Added!')}
                    </div>
                  )}
                  {action.status === 'dismissed' && (
                    <div className="chat-action-status dismissed">
                      {isRTL ? 'בוטל' : 'Dismissed'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="chat-input-row">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder={isRTL ? 'שאל על הטיול...' : 'Ask about the trip...'}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT_LENGTH))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            rows={1}
            disabled={sending}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
          <button
            className="chat-send-btn"
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            aria-label={isRTL ? 'שלח' : 'Send'}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
