import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, X, Check, Loader, AlertCircle } from 'lucide-react';
import {
  callAI,
  buildImportPrompt,
  parseImport,
  aiErrorMessage,
  getAIConfig,
} from '../firebase/aiService';
import type { ImportTarget, AIImportResult } from '../types/ai';

interface AIImportModalProps {
  target: ImportTarget;
  onAccept: (items: Record<string, any>[]) => Promise<void> | void;
  onClose: () => void;
}

const TARGET_LABELS: Record<ImportTarget, [string, string]> = {
  restaurant: ['Restaurant', 'מסעדה'],
  highlight: ['Attraction', 'אטרקציה'],
  hotel: ['Hotel', 'מלון'],
  flight: ['Flight', 'טיסה'],
};

type ModalState = 'idle' | 'processing' | 'review' | 'error';

export default function AIImportModal({ target, onAccept, onClose }: AIImportModalProps) {
  const { t, i18n } = useTranslation();
  const isHe = i18n.language === 'he';

  const [modalState, setModalState] = useState<ModalState>('idle');
  const [files, setFiles] = useState<File[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [results, setResults] = useState<AIImportResult[]>([]);
  const [error, setError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const config = getAIConfig();
  const [labelEn, labelHe] = TARGET_LABELS[target];
  const targetLabel = isHe ? labelHe : labelEn;

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    setFiles((prev) => [...prev, ...dropped]);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    e.target.value = '';
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleAnalyze() {
    setModalState('processing');
    setError('');
    try {
      const prompt = buildImportPrompt(target) +
        (pasteText.trim() ? `\n\nAdditional text context:\n${pasteText}` : '');
      const response = await callAI(prompt, files.length ? files : undefined);
      const parsed = parseImport(response, target);
      if (parsed.length === 0) {
        setError(t('ai.noResults'));
        setModalState('error');
        return;
      }
      setResults(parsed);
      setModalState('review');
    } catch (e) {
      setError(aiErrorMessage(e, isHe));
      setModalState('error');
    }
  }

  function handleToggle(id: string) {
    setResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, accepted: !r.accepted } : r))
    );
  }

  function handleAcceptAll() {
    setResults((prev) => prev.map((r) => ({ ...r, accepted: true })));
  }

  function handleFieldChange(id: string, field: string, value: string) {
    setResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, data: { ...r.data, [field]: value }, edited: true } : r))
    );
  }

  async function handleSave() {
    setModalState('processing');
    try {
      await onAccept(results.filter((r) => r.accepted).map((r) => r.data));
      onClose();
    } catch (e) {
      setError(aiErrorMessage(e, isHe));
      setModalState('error');
    }
  }

  const canAnalyze = files.length > 0 || pasteText.trim().length > 0;
  const acceptedCount = results.filter((r) => r.accepted).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ai-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── idle ── */}
        {modalState === 'idle' && (
          <>
            <div className="ai-modal-header">
              {isHe ? `ייבוא AI — ${targetLabel}` : `AI Import — ${targetLabel}`}
            </div>

            <div className="ai-provider-badge">
              {config.provider} / {config.model}
            </div>

            <div
              className={`ai-upload-zone ${isDragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={28} />
              <p style={{ margin: '8px 0 4px' }}>{t('ai.uploadHint')}</p>
              {files.length > 0 && (
                <div className="upload-files-list" onClick={(e) => e.stopPropagation()}>
                  {files.map((f, i) => (
                    <span key={i} className="ai-upload-file-chip">
                      {f.name}
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 4px', lineHeight: 1 }}
                        onClick={() => removeFile(i)}
                      >×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />

            <textarea
              className="ai-paste-area"
              placeholder={t('ai.pasteHint')}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />

            <div className="ai-modal-actions">
              <button className="admin-btn secondary" onClick={onClose}>{t('common.cancel')}</button>
              <button className="ai-save-btn" onClick={handleAnalyze} disabled={!canAnalyze}>
                {isHe ? 'נתח →' : 'Analyze →'}
              </button>
            </div>
          </>
        )}

        {/* ── processing ── */}
        {modalState === 'processing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '32px 16px' }}>
            <Loader size={32} className="spin" color="var(--brand-primary)" />
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center' }}>
              {t('ai.analyzingWith', { provider: config.provider, model: config.model })}
            </p>
          </div>
        )}

        {/* ── review ── */}
        {modalState === 'review' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div className="ai-modal-header" style={{ marginBottom: 0 }}>
                {t('ai.foundItems', { count: results.length })}
              </div>
              <button className="admin-btn secondary" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={handleAcceptAll}>
                {t('ai.acceptAll')}
              </button>
            </div>

            <div className="ai-review-list">
              {results.map((result) => (
                <div key={result.id} className={`ai-result-card ${result.accepted ? 'accepted' : 'rejected'}`}>
                  <div className="ai-result-card-header">
                    <span className="ai-result-card-name">
                      {result.data.name ?? result.data.airline ?? result.data.title ?? '—'}
                    </span>
                    <div className="ai-result-toggle">
                      <button
                        className={`ai-accept-btn ${result.accepted ? 'active' : ''}`}
                        onClick={() => handleToggle(result.id)}
                      >
                        <Check size={11} /> {t('ai.accept')}
                      </button>
                      <button
                        className={`ai-reject-btn ${!result.accepted ? 'active' : ''}`}
                        onClick={() => handleToggle(result.id)}
                      >
                        <X size={11} /> {t('ai.skip')}
                      </button>
                    </div>
                  </div>
                  <div className="ai-result-fields">
                    {Object.entries(result.data)
                      .filter(([, v]) => v !== null && v !== undefined && v !== '')
                      .map(([key, val]) => (
                        <div key={key} className="ai-result-field">
                          <label>{key}</label>
                          <input
                            value={String(val)}
                            onChange={(e) => handleFieldChange(result.id, key, e.target.value)}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="ai-modal-actions">
              <button className="admin-btn secondary" onClick={() => setModalState('idle')}>
                {t('common.back')}
              </button>
              <button className="ai-save-btn" onClick={handleSave} disabled={acceptedCount === 0}>
                {t('ai.saveSelected', { count: acceptedCount })}
              </button>
            </div>
          </>
        )}

        {/* ── error ── */}
        {modalState === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '24px 16px', textAlign: 'center' }}>
            <AlertCircle size={32} color="var(--red-500)" />
            <p style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{error}</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="admin-btn secondary" onClick={() => setModalState('idle')}>{t('common.back')}</button>
              <button className="ai-save-btn" onClick={handleAnalyze}>{t('ai.retryBtn')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
