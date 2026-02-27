import React, { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Plus, X, MapPin } from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import { savePhoto } from '../firebase/tripService';

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
  // Day to attach photo to (defaults to today or day 0)
  const [uploadDay] = useState<number>(todayDayIndex >= 0 ? todayDayIndex : 0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // All photos reverse-chronological, optionally filtered by day
  const feedPhotos = useMemo(() => {
    const base = filterDay === null ? photos : photos.filter((p) => p.dayIndex === filterDay);
    return [...base].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [photos, filterDay]);

  const getMember = (memberId: string) =>
    config?.familyMembers.find((m) => m.id === memberId);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreviewImage(ev.target?.result as string);
      setCaption('');
      setShowPreview(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSavePhoto = async () => {
    if (!previewImage || !tripCode || !currentMember) return;
    setSaving(true);
    try {
      await savePhoto(tripCode, {
        id: crypto.randomUUID(),
        dayIndex: uploadDay,
        memberId: currentMember.id,
        imageDataUrl: previewImage,
        caption: caption.trim() || undefined,
        timestamp: new Date().toISOString(),
      });
      setShowPreview(false);
      setPreviewImage(null);
      setCaption('');
    } catch (err) {
      console.error('Failed to save photo:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelPreview = () => {
    setShowPreview(false);
    setPreviewImage(null);
    setCaption('');
  };

  return (
    <div className="photos-page">
      <div className="photos-header">
        <h1 className="page-title" style={{ margin: 0 }}>
          <Camera size={22} style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />
          {t('photos.title')}
        </h1>
        <button
          className="add-photo-btn-sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <Plus size={18} />
          <span>{t('photos.takePhoto')}</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

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
            <button className="photo-preview-close" onClick={handleCancelPreview}>
              <X size={24} />
            </button>
            <img src={previewImage} alt="Preview" className="photo-preview-img" />
            <input
              type="text"
              className="photo-caption-input"
              placeholder={t('photos.addCaption')}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
            <button
              className="add-photo-btn save-btn"
              onClick={handleSavePhoto}
              disabled={saving}
            >
              <Camera size={20} />
              <span>{saving ? '...' : t('photos.takePhoto')}</span>
            </button>
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
