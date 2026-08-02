import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Loader, ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import {
  callAI,
  buildSuggestPrompt,
  extractSuggestions,
  aiErrorMessage,
  type SuggestContext,
} from '../firebase/aiService';
import type { AISuggestion } from '../types/ai';

interface AISuggestPanelProps {
  type: 'restaurant' | 'highlight' | 'passport-stamp';
  context: SuggestContext;
  onAccept: (items: Record<string, unknown>[]) => void;
}

function getCategoryIcon(type: string, category?: string): string {
  if (type === 'restaurant') return '🍽️';
  const map: Record<string, string> = {
    beach: '🏖️', ruins: '🏛️', museum: '🏛️', food: '🍜',
    'kids-fun': '🎡', nature: '🌿', shopping: '🛍️', viewpoint: '🌅', other: '📍',
  };
  return map[category ?? ''] ?? '📍';
}

export default function AISuggestPanel({ type, context, onAccept }: AISuggestPanelProps) {
  const { i18n } = useTranslation();
  const isHe = i18n.language === 'he';

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [error, setError] = useState('');

  const isStamp = type === 'passport-stamp';
  const titleText = isHe
    ? (isStamp ? 'צור חותמות עם AI' : 'הצעות AI')
    : (isStamp ? 'Generate Stamps with AI' : 'AI Suggestions');
  const suggestBtnText = isHe ? 'הפעל' : 'Suggest';

  async function handleSuggest() {
    setLoading(true);
    setOpen(true);
    setError('');
    setSuggestions([]);
    try {
      const prompt = buildSuggestPrompt(type, context);
      const response = await callAI(prompt);
      const found = extractSuggestions(response, type);
      setSuggestions(found);
    } catch (e) {
      setError(aiErrorMessage(e, isHe));
    } finally {
      setLoading(false);
    }
  }

  function toggleSuggestion(i: number) {
    setSuggestions((prev) => prev.map((s, idx) =>
      idx === i ? { ...s, accepted: !s.accepted } : s
    ));
  }

  function handleAcceptAll() {
    setSuggestions((prev) => prev.map((s) => ({ ...s, accepted: true })));
  }

  function handleSave() {
    onAccept(suggestions.filter((s) => s.accepted).map((s) => s.data));
    setSuggestions((prev) => prev.map((s) => ({ ...s, accepted: false })));
  }

  const acceptedCount = suggestions.filter((s) => s.accepted).length;

  return (
    <div className="ai-suggest-panel">
      <div className="ai-suggest-panel-header" onClick={() => setOpen((o) => !o)}>
        <div className="ai-suggest-panel-title">
          <Sparkles size={16} color="#9333ea" />
          {titleText}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!loading && (
            <button
              className="ai-suggest-btn"
              onClick={(e) => { e.stopPropagation(); handleSuggest(); }}
            >
              <Sparkles size={13} />
              {suggestBtnText}
            </button>
          )}
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {open && (
        <div className="ai-suggest-panel-body">
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', padding: '12px 0' }}>
              <Loader size={16} className="spin" />
              {isHe ? 'מחפש הצעות...' : 'Finding suggestions...'}
            </div>
          )}

          {error && !loading && (
            <div style={{ color: 'var(--red-500)', fontSize: '13px', padding: '8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {error}
              <button className="admin-btn secondary" style={{ fontSize: '12px', padding: '3px 8px' }} onClick={handleSuggest}>
                {isHe ? 'נסה שוב' : 'Retry'}
              </button>
            </div>
          )}

          {!loading && suggestions.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {isHe ? `נמצאו ${suggestions.length} הצעות` : `${suggestions.length} suggestions`}
                </span>
                <button
                  className="admin-btn secondary"
                  style={{ fontSize: '12px', padding: '3px 8px' }}
                  onClick={handleAcceptAll}
                >
                  {isHe ? 'קבל הכל' : 'Accept All'}
                </button>
              </div>

              <div className="ai-review-list">
                {suggestions.map((s, i) => (
                  <div key={s.id} className={`ai-suggestion-card ${s.accepted ? 'accepted' : ''}`}>
                    <div className="ai-suggestion-icon">
                      {(s.data.icon as string | undefined) ?? getCategoryIcon(s.type, s.data.category as string | undefined)}
                    </div>
                    <div className="ai-suggestion-body">
                      <div className="ai-suggestion-name">{(s.data.name ?? s.data.title ?? '—') as string}</div>
                      <div className="ai-suggestion-meta">
                        {[s.data.cuisine, s.data.category, s.data.location]
                          .filter(Boolean)
                          .join(' · ')}
                        {s.data.city ? ` · ${s.data.city}` : ''}
                        {s.data.priceRange ? ` · ${s.data.priceRange}` : ''}
                      </div>
                      {s.rationale && (
                        <div className="ai-suggestion-rationale">{s.rationale}</div>
                      )}
                    </div>
                    <div className="ai-suggestion-actions">
                      <button
                        className={`ai-accept-btn ${s.accepted ? 'active' : ''}`}
                        onClick={() => toggleSuggestion(i)}
                        title={isHe ? 'קבל' : 'Accept'}
                      >
                        <Check size={12} />
                      </button>
                      <button
                        className={`ai-reject-btn ${!s.accepted ? 'active' : ''}`}
                        onClick={() => toggleSuggestion(i)}
                        title={isHe ? 'דלג' : 'Skip'}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {acceptedCount > 0 && (
                <div className="ai-modal-actions" style={{ marginTop: '12px' }}>
                  <button className="ai-save-btn" onClick={handleSave}>
                    {isHe
                      ? `שמור ${acceptedCount} שנבחרו`
                      : `Save ${acceptedCount} selected`}
                  </button>
                </div>
              )}
            </>
          )}

          {!loading && !error && suggestions.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px 0' }}>
              {isHe ? 'לחץ על "הפעל" כדי לקבל הצעות' : 'Click "Suggest" to get recommendations'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
