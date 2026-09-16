import React, { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, X, MapPin, ImagePlus } from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import { savePhoto } from '../firebase/tripService';
import { downscaleToDataUrl } from '../utils/imageResize';

const TOTAL_DAYS = 12;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const PhotosPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { photos, tripCode, currentMember, config, todayDayIndex } = useTripContext();
  const isRTL = i18n.language === 'he';

  // "All" = null, day N = N
  const [filterDay, setFilterDay] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [photoError, setPhotoError] = useState('');
  // Day to attach photo to (defaults to today or day 0)
  const [uploadDay] = useState<number>(todayDayIndex >= 0 ? todayDayIndex : 0);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // All photos reverse-chronological, optionally filtered by day
  const feedPhotos = useMemo(() => {
    const base = filterDay === null ? photos : photos.filter((p) => p.dayIndex === filterDay);
    return [...base].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [photos, filterDay]);

  const getMember = (memberId: string) =>
    config?.familyMembers.find((m) => m.id === memberId);

  // Picking from the gallery usually means picking several, so selections are
  // queued and captioned one at a time rather than collapsed into one photo.
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;

    setPreparing(true);
    try {
      const prepared = await Promise.all(files.map((f) => downscaleToDataUrl(f)));
      const [first, ...rest] = prepared;
      setQueue(rest);
      setPreviewImage(first);
      setCaption('');
      setShowPreview(true);
    } catch (err) {
      console.error('Failed to read photos:', err);
    } finally {
      setPreparing(false);
    }
  };

  /**
   * Move to the next queued photo, or close when the queue is empty.
   *
   * Derived from the current queue rather than from inside a setQueue updater:
   * React may invoke an updater more than once, and updating other state in
   * there can advance the queue twice and silently skip a photo.
   */
  const advanceQueue = () => {
    const [next, ...remaining] = queue;
    setCaption('');
    setUploadPercent(null);
    setPhotoError('');
    setQueue(remaining);
    if (next === undefined) {
      setShowPreview(false);
      setPreviewImage(null);
    } else {
      setPreviewImage(next);
    }
  };

  const handleSavePhoto = async () => {
    if (!previewImage || !tripCode) return;
    if (!currentMember) {
      // Silently doing nothing here read as a dead button.
      setPhotoError(
        isRTL ? 'בחרו קודם מי אתם במסך הבית.' : 'Choose who you are on the home screen first.'
      );
      return;
    }
    setSaving(true);
    setPhotoError('');
    setUploadPercent(0);
    try {
      await savePhoto(
        tripCode,
        {
          id: crypto.randomUUID(),
          dayIndex: uploadDay,
          memberId: currentMember.id,
          imageDataUrl: previewImage,
          caption: caption.trim() || undefined,
          timestamp: new Date().toISOString(),
        },
        setUploadPercent
      );
      advanceQueue();
    } catch (err) {
      // An upload that fails silently is indistinguishable from one still
      // running, which is exactly how this looked: the button sat on "..."
      // with nothing to say what went wrong.
      console.error('Failed to save photo:', err);
      const code = (err as { code?: string })?.code ?? '';
      setPhotoError(
        (isRTL ? 'ההעלאה נכשלה' : 'Upload failed') + (code ? ` (${code})` : '') + '. ' +
        (isRTL ? 'נסו שוב.' : 'Try again.')
      );
      setUploadPercent(null);
    } finally {
      setSaving(false);
    }
  };

  // Skipping one photo should not throw away the rest of the selection.
  const handleSkipPhoto = () => advanceQueue();

  /** Abandon the whole selection, not just the photo on screen. */
  const handleCancelAll = () => {
    setQueue([]);
    setShowPreview(false);
    setPreviewImage(null);
    setCaption('');
    setUploadPercent(null);
    setPhotoError('');
  };

  return (
    <div className="photos-page">
      <div className="photos-header">
        <h1 className="page-title" style={{ margin: 0 }}>
          <Camera size={22} style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />
          {t('photos.title')}
        </h1>
        <div className="photo-add-actions">
          <button
            className="add-photo-btn-sm"
            onClick={() => cameraInputRef.current?.click()}
            disabled={preparing}
          >
            <Camera size={17} />
            <span>{t('photos.takePhoto')}</span>
          </button>
          <button
            className="add-photo-btn-sm secondary"
            onClick={() => galleryInputRef.current?.click()}
            disabled={preparing}
          >
            <ImagePlus size={17} />
            <span>{isRTL ? 'מהגלריה' : 'From gallery'}</span>
          </button>
        </div>
      </div>

      {/* capture sends iOS straight to the camera and removes the photo library
          from the sheet entirely, so picking from the gallery needs an input
          without it. multiple, because choosing several at once is the norm. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {preparing && (
        <p className="photo-preparing">
          {isRTL ? 'מכין את התמונות…' : 'Preparing photos…'}
        </p>
      )}

      {/* Day filter tabs */}
      <div className="photo-day-tabs">
        <button
          className={`photo-day-tab ${filterDay === null ? 'active' : ''}`}
          onClick={() => setFilterDay(null)}
        >
          {isRTL ? 'הכל' : 'All'}
        </button>
        {Array.from({ length: TOTAL_DAYS }, (_, i) => (
          <button
            key={i}
            className={`photo-day-tab ${filterDay === i ? 'active' : ''} ${todayDayIndex === i ? 'today' : ''}`}
            onClick={() => setFilterDay(i)}
          >
            {isRTL ? `יום ${i + 1}` : `Day ${i + 1}`}
          </button>
        ))}
      </div>

      {/* Photo preview overlay */}
      {showPreview && previewImage && (
        <div className="photo-preview">
          <div className="photo-preview-content">
            <button
              className="photo-preview-close"
              onClick={handleCancelAll}
              title={isRTL ? 'ביטול הכל' : 'Cancel all'}
            >
              <X size={24} />
            </button>
            {queue.length > 0 && (
              <div className="photo-queue-count">
                {isRTL ? `נותרו עוד ${queue.length}` : `${queue.length} more to go`}
              </div>
            )}
            <img src={previewImage} alt="Preview" className="photo-preview-img" />
            <input
              type="text"
              className="photo-caption-input"
              placeholder={t('photos.addCaption')}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
            {photoError && <p className="photo-error">{photoError}</p>}

            <div className="photo-preview-actions">
              <button
                className="add-photo-btn save-btn"
                onClick={handleSavePhoto}
                disabled={saving}
              >
                <Camera size={20} />
                <span>
                  {saving
                    ? (uploadPercent !== null
                        ? `${isRTL ? 'מעלה' : 'Uploading'} ${uploadPercent}%`
                        : (isRTL ? 'מעלה…' : 'Uploading…'))
                    : (isRTL ? 'הוסף' : 'Add')}
                </span>
              </button>
              {queue.length > 0 && (
                <button className="photo-skip-btn" onClick={handleSkipPhoto} disabled={saving}>
                  {isRTL ? 'דלג' : 'Skip'}
                </button>
              )}
            </div>

            {saving && uploadPercent !== null && (
              <div className="photo-upload-bar">
                <span style={{ width: `${uploadPercent}%` }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feed */}
      {feedPhotos.length === 0 ? (
        <div className="empty-state">
          <Camera size={48} strokeWidth={1} />
          <p>{t('photos.noPhotos')}</p>
        </div>
      ) : (
        <div className="photo-feed">
          {feedPhotos.map((photo) => {
            const member = getMember(photo.memberId);
            return (
              <div key={photo.id} className="photo-feed-card">
                {/* Header */}
                <div className="photo-feed-header">
                  <span className="photo-feed-emoji">{member?.emoji ?? '📷'}</span>
                  <span className="photo-feed-name">
                    {member ? (isRTL ? member.nameHe : member.name) : ''}
                  </span>
                  <span className="photo-feed-time">{timeAgo(photo.timestamp)}</span>
                </div>
                {/* Image */}
                <img
                  src={photo.imageUrl}
                  alt={photo.caption || 'Photo'}
                  className="photo-feed-img"
                  loading="lazy"
                />
                {/* Caption + day badge */}
                <div className="photo-feed-footer">
                  {photo.caption && (
                    <p className="photo-feed-caption">{photo.caption}</p>
                  )}
                  {photo.dayIndex !== undefined && (
                    <div className="photo-feed-day">
                      <MapPin size={12} />
                      {isRTL ? `יום ${photo.dayIndex + 1}` : `Day ${photo.dayIndex + 1}`}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PhotosPage;
