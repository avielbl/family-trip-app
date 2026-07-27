import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileText, Check, Loader, AlertCircle } from 'lucide-react';
import { importTripData } from '../firebase/tripService';
import {
  buildBookingPrompt,
  extractFromImages,
  getAiSettings,
  hasAiKey,
  saveAiSettings,
  stripJsonFences,
} from '../ai';

interface BookingImportProps {
  tripCode: string;
  startDate: string;
  endDate: string;
  onDone: () => void;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Extract base64 part after data:...;base64,
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function BookingImport({
  tripCode,
  startDate,
  endDate,
  onDone,
}: BookingImportProps) {
  const { t, i18n } = useTranslation();
  const isHe = i18n.language === 'he';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState('');
  const [parseError, setParseError] = useState('');
  const [saving, setSaving] = useState(false);
  // Show the inline key input when no key is configured on first render, and
  // keep it visible while the user types one in.
  const [showKeyInput] = useState(() => !hasAiKey());
  const [apiKey, setApiKey] = useState(() => getAiSettings().apiKey);

  const providerLabel =
    getAiSettings().provider === 'gemini' ? 'Google Gemini' : 'Anthropic (Claude)';

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  }

  async function handleParse() {
    if (!files.length) return;
    if (!hasAiKey()) {
      setParseError(isHe ? 'נדרש מפתח AI (בהגדרות)' : 'AI API key required (Settings)');
      return;
    }
    setParsing(true);
    setParseError('');

    try {
      const images = await Promise.all(
        files.map(async (file) => ({
          mediaType: file.type || 'image/png',
          base64: await fileToBase64(file),
        }))
      );

      const text = await extractFromImages(buildBookingPrompt(startDate, endDate), images);
      setParsedData(stripJsonFences(text));
    } catch (err) {
      setParseError((err as Error).message);
    } finally {
      setParsing(false);
    }
  }

  async function handleSaveParsed() {
    if (!parsedData) return;
    setSaving(true);
    try {
      const parsed = JSON.parse(parsedData);
      await importTripData(tripCode, parsed);
      onDone();
    } catch (err) {
      setParseError(
        err instanceof SyntaxError
          ? `Invalid JSON: ${err.message}`
          : (err as Error).message
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="setup-form">
      {showKeyInput && (
        <>
          <p className="setup-error">
            <AlertCircle size={16} />{' '}
            {isHe
              ? 'לא הוגדר מפתח AI. הגדירו אותו בהגדרות, או הזינו אותו כאן:'
              : 'No AI API key configured. Set one in Settings, or enter it below:'}
          </p>
          <label className="setup-label">
            {isHe ? 'מפתח AI API' : 'AI API Key'}
            <input
              type="password"
              className="setup-input"
              placeholder="sk-ant-... / AIza..."
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                saveAiSettings({ ...getAiSettings(), apiKey: e.target.value });
              }}
            />
            <span style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>
              {isHe
                ? `המפתח נשמר עבור ספק ה-AI הנוכחי: ${providerLabel} (ניתן להחליף ספק בהגדרות)`
                : `Saved for the current AI provider: ${providerLabel} (switch providers in Settings)`}
            </span>
          </label>
        </>
      )}

      <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
        <Upload size={40} />
        <p>{t('setup.selectFiles')}</p>
        {files.length > 0 && (
          <div className="file-list">
            {files.map((f, i) => (
              <div key={i} className="file-item">
                <FileText size={16} />
                <span>{f.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {parsing && (
        <div className="parsing-status">
          <Loader size={20} className="spin" />
          <span>{t('setup.parsing')}</span>
        </div>
      )}

      {parsedData && (
        <div className="parsed-preview">
          <div className="parsed-header">
            <Check size={20} /> {t('setup.parsed')}
          </div>
          <textarea
            className="parsed-json"
            value={parsedData}
            onChange={(e) => setParsedData(e.target.value)}
            rows={10}
          />
          <button className="setup-btn primary" onClick={handleSaveParsed} disabled={saving}>
            {saving ? <Loader size={16} className="spin" /> : null}
            {t('setup.save')}
          </button>
        </div>
      )}

      {parseError && (
        <p className="setup-error">
          <AlertCircle size={16} /> {parseError}
        </p>
      )}

      {!parsedData && (
        <button
          className="setup-btn primary"
          onClick={handleParse}
          disabled={parsing || !files.length}
        >
          {t('setup.review')}
        </button>
      )}

      <button className="setup-btn secondary" onClick={onDone}>
        {isHe ? 'דלג והמשך' : 'Skip & Continue'}
      </button>
    </div>
  );
}
