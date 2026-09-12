import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Download,
  FileJson,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import { applyImportPlan } from '../firebase/tripService';
import {
  buildSnapshot,
  parseSnapshotJson,
  SnapshotParseError,
  snapshotToJson,
  type SnapshotInput,
} from '../utils/tripSnapshot';
import { snapshotToWorkbook, workbookToSnapshot } from '../utils/tripWorkbook';
import {
  buildImportPlan,
  deletionLabels,
  describePlan,
  type ImportPlan,
} from '../utils/tripImportPlan';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function TripDataPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const isHe = i18n.language === 'he';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    tripCode,
    isAdmin,
    config,
    days,
    flights,
    hotels,
    driving,
    rentalCars,
    highlights,
    restaurants,
    packingItems,
  } = useTripContext();

  const [busy, setBusy] = useState<'json' | 'xlsx' | 'reading' | 'applying' | null>(null);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [fileName, setFileName] = useState('');
  const [done, setDone] = useState('');

  const current: SnapshotInput = {
    tripCode: tripCode ?? '',
    config,
    days,
    flights,
    hotels,
    driving,
    rentalCars,
    highlights,
    restaurants,
    packing: packingItems,
  };

  const stamp = new Date().toISOString().slice(0, 10);
  const baseName = `trip-${tripCode ?? 'export'}-${stamp}`;

  async function handleExport(kind: 'json' | 'xlsx') {
    setError('');
    setBusy(kind);
    try {
      const snapshot = buildSnapshot(current);
      if (kind === 'json') {
        downloadBlob(
          new Blob([snapshotToJson(snapshot)], { type: 'application/json' }),
          `${baseName}.json`
        );
      } else {
        downloadBlob(await snapshotToWorkbook(snapshot), `${baseName}.xlsx`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file after an edit
    if (!file) return;

    setError('');
    setDone('');
    setPlan(null);
    setFileName(file.name);
    setBusy('reading');
    try {
      const isJson = /\.json$/i.test(file.name);
      const snapshot = isJson
        ? parseSnapshotJson(await file.text())
        : await workbookToSnapshot(file, tripCode ?? '');
      setPlan(buildImportPlan(snapshot, current, { mirror: true }));
    } catch (err) {
      setError(
        err instanceof SnapshotParseError
          ? err.message
          : `${isHe ? 'לא ניתן לקרוא את הקובץ' : 'Could not read the file'}: ${(err as Error).message}`
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleApply() {
    if (!plan || !tripCode) return;
    setBusy('applying');
    setError('');
    try {
      const result = await applyImportPlan(tripCode, plan, days);
      setDone(
        isHe
          ? `היבוא הושלם: ${result.written} רשומות נכתבו, ${result.deleted} נמחקו.`
          : `Import complete: ${result.written} records written, ${result.deleted} deleted.`
      );
      setPlan(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!isAdmin) {
    return (
      <div className="admin-page">
        <p className="setup-error">
          <AlertTriangle size={16} />{' '}
          {isHe ? 'הדף הזה זמין למנהל הטיול בלבד.' : 'This page is for the trip admin only.'}
        </p>
      </div>
    );
  }

  const summary = plan ? describePlan(plan, isHe) : [];
  const deletions = plan ? deletionLabels(plan, isHe) : [];
  const nothingToDo = plan !== null && plan.totalWrites === 0 && plan.totalDeletes === 0;

  return (
    <div className="admin-page">
      <button className="admin-btn secondary" onClick={() => navigate('/admin')}>
        <ArrowLeft size={14} /> {isHe ? 'חזרה לניהול' : 'Back to Admin'}
      </button>

      <h1 className="page-title">{isHe ? 'ייצוא וייבוא תוכנית' : 'Export & Import Plan'}</h1>

      {/* ── Export ── */}
      <div className="admin-section">
        <div className="admin-section-title">
          <Download size={16} />
          {isHe ? 'ייצוא' : 'Export'}
        </div>
        <p className="data-transfer-hint">
          {isHe
            ? 'הורידו את התוכנית, ערכו אותה במחשב, והחזירו אותה למטה. קובץ JSON שומר הכול; קובץ אקסל נוח יותר לעריכה ידנית.'
            : 'Download the plan, edit it on your computer, then bring it back below. JSON keeps everything; Excel is easier to edit by hand.'}
        </p>
        <div className="data-transfer-buttons">
          <button
            className="admin-btn primary"
            onClick={() => handleExport('json')}
            disabled={busy !== null}
          >
            {busy === 'json' ? <Loader2 size={14} className="spin" /> : <FileJson size={14} />}
            {isHe ? 'ייצוא JSON' : 'Export JSON'}
          </button>
          <button
            className="admin-btn primary"
            onClick={() => handleExport('xlsx')}
            disabled={busy !== null}
          >
            {busy === 'xlsx' ? <Loader2 size={14} className="spin" /> : <FileSpreadsheet size={14} />}
            {isHe ? 'ייצוא אקסל' : 'Export Excel'}
          </button>
        </div>
        <p className="data-transfer-note">
          {isHe
            ? 'נכללים: ימים ותוכנית יומית, טיסות, מלונות, מסלולי נסיעה, רכבי שכירות, אטרקציות, מסעדות וציוד. לא נכללים: תמונות, חידון, יומן מסע וחותמות.'
            : 'Included: days and their plans, flights, hotels, driving, rental cars, attractions, restaurants, packing. Not included: photos, quiz, travel log, passport stamps.'}
        </p>
      </div>

      {/* ── Import ── */}
      <div className="admin-section">
        <div className="admin-section-title">
          <Upload size={16} />
          {isHe ? 'ייבוא קובץ ערוך' : 'Import an edited file'}
        </div>
        <p className="data-transfer-hint">
          {isHe
            ? 'הקובץ הוא מקור האמת: פריט שתמחקו מהקובץ יימחק גם מהטיול. תראו בדיוק מה ישתנה לפני שמשהו נכתב.'
            : 'The file is the source of truth: an item you delete from it is deleted from the trip too. You will see exactly what changes before anything is written.'}
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.xlsx,application/json"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        <button
          className="admin-btn secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy !== null}
        >
          {busy === 'reading' ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
          {isHe ? 'בחרו קובץ (.json או .xlsx)' : 'Choose a file (.json or .xlsx)'}
        </button>
        {fileName && <p className="data-transfer-note">{fileName}</p>}

        {error && (
          <p className="setup-error">
            <AlertTriangle size={16} /> {error}
          </p>
        )}

        {done && (
          <p className="data-transfer-ok">
            <Check size={16} /> {done}
          </p>
        )}

        {plan && (
          <div className="data-transfer-plan">
            {plan.tripCodeMismatch && (
              <p className="setup-error">
                <AlertTriangle size={16} />{' '}
                {isHe
                  ? `הקובץ שייך לטיול ${plan.tripCodeMismatch}, לא ל-${tripCode}. ודאו שזה הקובץ הנכון.`
                  : `This file came from trip ${plan.tripCodeMismatch}, not ${tripCode}. Check it is the right file.`}
              </p>
            )}

            {nothingToDo ? (
              <p className="data-transfer-note">
                {isHe ? 'אין שינויים בקובץ הזה.' : 'No changes in this file.'}
              </p>
            ) : (
              <>
                <div className="data-transfer-summary-title">
                  {isHe ? 'מה ישתנה:' : 'What will change:'}
                </div>
                <ul className="data-transfer-summary">
                  {summary.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>

                {deletions.length > 0 && (
                  <div className="data-transfer-danger">
                    <div className="data-transfer-summary-title">
                      <AlertTriangle size={14} />{' '}
                      {isHe
                        ? `${deletions.length} פריטים יימחקו לצמיתות:`
                        : `${deletions.length} items will be permanently deleted:`}
                    </div>
                    <ul className="data-transfer-summary">
                      {deletions.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="data-transfer-buttons">
                  <button
                    className="admin-btn primary"
                    onClick={handleApply}
                    disabled={busy !== null}
                  >
                    {busy === 'applying' ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                    {isHe ? 'החילו את השינויים' : 'Apply these changes'}
                  </button>
                  <button
                    className="admin-btn secondary"
                    onClick={() => {
                      setPlan(null);
                      setFileName('');
                    }}
                    disabled={busy !== null}
                  >
                    {isHe ? 'ביטול' : 'Cancel'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
