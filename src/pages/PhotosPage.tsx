import React, { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import { savePhoto } from '../firebase/tripService';
import type { PhotoEntry } from '../types/trip';

const TOTAL_DAYS = 12;

const PhotosPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { photos, tripCode, currentMember, config, todayDayIndex } = useTripContext();
  const isRTL = i18n.language === 'he';

  const [selectedDay, setSelectedDay] = useState<number>(
    todayDayIndex >= 0 ? todayDayIndex : 0
  );
  const [showPreview, setShowPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Photos for the selected day
  const dayPhotos = useMemo(
    () =>
      photos
        .filter((p) => p.dayIndex === selectedDay)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [photos, selectedDay]
  );

  // Find family member by id
  const getMember = (memberId: string) =>
    config?.familyMembers.find((m) => m.id === memberId);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPreviewImage(dataUrl);
      setCaption('');
      setShowPreview(true);
    };
    reader.readAsDataURL(file);

    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  // Save photo
  const handleSavePhoto = async () => {
    if (!previewImage || !tripCode || !currentMember) return;

    setSaving(true);
    try {
      const photo: PhotoEntry = {
        id: crypto.randomUUID(),
        dayIndex: selectedDay,
        memberId: currentMember.id,
        imageDataUrl: previewImage,
        caption: caption.trim() || undefined,
        timestamp: new Date().toISOString(),
      };
      await savePhoto(tripCode, photo);
      setShowPreview(false);
      setPreviewImage(null);
      setCaption('');
    } catch (err) {
      console.error('Failed to save photo:', err);
    } finally {
      setSaving(false);
    }
  };

  // Cancel preview
  const handleCancelPreview = () => {
    setShowPreview(false);
    setPreviewImage(null);
    setCaption('');
  };

  // Navigate days
  const goToPrevDay = () => {
    if (selectedDay > 0) setSelectedDay(selectedDay - 1);
  };

  const goToNextDay = () => {
    if (selectedDay < TOTAL_DAYS - 1) setSelectedDay(selectedDay + 1);
  };

  return (
    <div className="photos-page">
      <h1>
        <Camera size={24} />
        <span>{t('photos.title')}</span>
      </h1>

      {/* Day selector tabs */}
      <div className="day-tabs">
        <button
          className="day-tab"
          onClick={goToPrevDay}
          disabled={selectedDay === 0}
          aria-label="Previous day"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="day-tabs-scroll">
          {Array.from({ length: TOTAL_DAYS }, (_, i) => (
            <button
              key={i}
              className={`day-tab ${selectedDay === i ? 'active' : ''} ${todayDayIndex === i ? 'today' : ''}`}
              onClick={() => setSelectedDay(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <button
          className="day-tab"
          onClick={goToNextDay}
          disabled={selectedDay === TOTAL_DAYS - 1}
          aria-label="Next day"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Day label */}
      <p className="photo-day-label">
        {t('photos.photoOfDay', { day: selectedDay + 1 })}
      </p>

      {/* Add photo button */}
      <button
        className="add-photo-btn"
        onClick={() => fileInputRef.current?.click()}
      >
        <Plus size={20} />
        <span>{t('photos.takePhoto')}</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Photo preview overlay */}
      {showPreview && previewImage && (
        <div className="photo-preview">
          <div className="photo-preview-content">
            <button className="photo-preview-close" onClick={handleCancelPreview}>
              <X size={24} />
            </button>
            <img
              src={previewImage}
              alt="Preview"
              className="photo-preview-img"
            />
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

      {/* Photo gallery grid */}
      {dayPhotos.length === 0 ? (
        <div className="empty-state">
          <Camera size={48} strokeWidth={1} />
          <p>{t('photos.noPhotos')}</p>
        </div>
      ) : (
        <div className="photo-grid">
          {dayPhotos.map((photo) => {
            const member = getMember(photo.memberId);
            return (
              <div key={photo.id} className="photo-card">
                <img
                  src={photo.imageDataUrl}
                  alt={photo.caption || 'Photo'}
                  className="photo-img"
                />
                {photo.caption && (
                  <p className="photo-caption">{photo.caption}</p>
                )}
                <div className="photo-member">
                  {member && (
                    <>
                      <span className="member-emoji">{member.emoji}</span>
                      <span className="member-name">
                        {t('photos.byMember', {
                          name: isRTL ? member.nameHe : member.name,
                        })}
                      </span>
                    </>
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
