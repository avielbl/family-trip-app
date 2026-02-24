import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Sparkles,
  Loader,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
  Image,
} from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import { saveTravelLogEntry } from '../firebase/tripService';
import { savePhoto } from '../firebase/tripService';
import type { TravelLogEntry, ContentBlock } from '../types/trip';

export default function TravelLogPage() {
  const { t, i18n } = useTranslation();
  const {
    travelLog,
    days,
    tripCode,
    currentMember,
    highlights,
  } = useTripContext();

  const [selectedDay, setSelectedDay] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const isHe = i18n.language === 'he';

  const entry = travelLog.find((e) => e.dayIndex === selectedDay);
  const currentDay = days.find((d) => d.dayIndex === selectedDay);

  const apiKey = localStorage.getItem('claudeApiKey') ?? '';

  async function handleGenerate() {
    if (!currentDay || !tripCode) return;
    if (!apiKey) {
      setGenError(isHe ? 'נדרש מפתח Claude API (נשמר בהגדרות)' : 'Claude API key required (saved in settings)');
      return;
    }

    setGenerating(true);
    setGenError('');

    const dayHighlights = highlights.filter((h) => h.dayIndex === selectedDay && h.completed);
    const photos = (entry?.blocks ?? []).filter((b) => b.type === 'photo');

    const prompt = `You are writing a family travel log entry for Day ${selectedDay + 1} of our Greece 2026 trip.
Day title: ${currentDay.title}
Location: ${currentDay.location}
Completed highlights: ${dayHighlights.map((h) => h.name).join(', ') || 'none yet'}
Photo captions: ${photos.map((p) => p.caption).filter(Boolean).join('; ') || 'none'}

Write a warm, fun, family-friendly travel log entry in English. Include a brief narrative of what we did, what we saw, and any memorable moments. Keep it to 2-3 paragraphs. Return ONLY the text content, no markdown, no title.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.content[0]?.text ?? '';

      // Build new entry preserving existing blocks, replacing text blocks
      const existingPhotoBlocks = (entry?.blocks ?? []).filter((b) => b.type === 'photo');
      const newTextBlock: ContentBlock = {
        id: `block-${Date.now()}`,
        type: 'text',
        content: text,
        order: 0,
      };

      const updatedEntry: TravelLogEntry = {
        id: entry?.id ?? `log-${selectedDay}`,
        dayIndex: selectedDay,
        title: currentDay.title,
        titleHe: currentDay.titleHe,
        location: currentDay.location,
        blocks: [newTextBlock, ...existingPhotoBlocks.map((b, i) => ({ ...b, order: i + 1 }))],
        generatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveTravelLogEntry(tripCode, updatedEntry);
    } catch (e: any) {
      setGenError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveText(blockId: string) {
    if (!entry || !tripCode) return;
    const updatedBlocks = entry.blocks.map((b) =>
      b.id === blockId ? { ...b, content: editText } : b
    );
    await saveTravelLogEntry(tripCode, {
      ...entry,
      blocks: updatedBlocks,
      updatedAt: new Date().toISOString(),
    });
    setEditingBlock(null);
    setEditText('');
  }

  async function handleDeleteBlock(blockId: string) {
    if (!entry || !tripCode) return;
    const updatedBlocks = entry.blocks.filter((b) => b.id !== blockId);
    await saveTravelLogEntry(tripCode, {
      ...entry,
      blocks: updatedBlocks,
      updatedAt: new Date().toISOString(),
    });
  }

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !tripCode || !currentMember) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const photoId = `photo-${Date.now()}`;
      await savePhoto(tripCode, {
        id: photoId,
        dayIndex: selectedDay,
        memberId: currentMember.id,
        imageDataUrl: dataUrl,
        timestamp: new Date().toISOString(),
      });

      // Add photo block to travel log entry
      const photoBlock: ContentBlock = {
        id: `block-${photoId}`,
        type: 'photo',
        imageUrl: '', // will be filled after upload... for now we embed URL later
        order: (entry?.blocks.length ?? 0) + 1,
      };

      const updatedEntry: TravelLogEntry = {
        id: entry?.id ?? `log-${selectedDay}`,
        dayIndex: selectedDay,
        title: currentDay?.title ?? `Day ${selectedDay + 1}`,
        location: currentDay?.location ?? '',
        blocks: [...(entry?.blocks ?? []), photoBlock],
        updatedAt: new Date().toISOString(),
      };
      await saveTravelLogEntry(tripCode, updatedEntry);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleAddTextBlock() {
    if (!tripCode) return;
    const newBlock: ContentBlock = {
      id: `block-${Date.now()}`,
      type: 'text',
      content: '',
      order: (entry?.blocks.length ?? 0) + 1,
    };
    const updatedEntry: TravelLogEntry = {
      id: entry?.id ?? `log-${selectedDay}`,
      dayIndex: selectedDay,
      title: currentDay?.title ?? `Day ${selectedDay + 1}`,
      location: currentDay?.location ?? '',
      blocks: [...(entry?.blocks ?? []), newBlock],
      updatedAt: new Date().toISOString(),
    };
    await saveTravelLogEntry(tripCode, updatedEntry);
    setEditingBlock(newBlock.id);
    setEditText('');
  }

  return (
    <div className="travel-log-page">
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <BookOpen size={22} />
        {isHe ? 'יומן טיול' : 'Travel Log'}
      </h1>

      {/* Day tabs */}
      <div className="day-tabs">
        {days.map((day) => (
          <button
            key={day.dayIndex}
            className={`day-tab ${selectedDay === day.dayIndex ? 'active' : ''}`}
            onClick={() => setSelectedDay(day.dayIndex)}
          >
            {day.dayIndex + 1}
          </button>
        ))}
      </div>

      {currentDay && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
            {isHe && currentDay.titleHe ? currentDay.titleHe : currentDay.title}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{currentDay.location}</div>
        </div>
      )}

      {/* AI Generate button */}
      <button
        className="travel-log-generate-btn"
        onClick={handleGenerate}
        disabled={generating || !apiKey}
      >
        {generating ? <Loader size={16} className="spin" /> : <Sparkles size={16} />}
        {generating
          ? (isHe ? 'מייצר...' : 'Generating...')
          : (isHe ? 'ייצר יומן עם AI' : 'Generate with AI')}
      </button>

      {genError && (
        <p style={{ color: 'var(--red-500)', fontSize: '13px', marginBottom: '12px' }}>{genError}</p>
      )}

      {/* Entry content */}
      {entry ? (
        <div className="travel-log-entry">
          {entry.blocks
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((block) => (
              <div key={block.id} style={{ marginBottom: '12px', position: 'relative' }}>
                {block.type === 'text' && (
                  <>
                    {editingBlock === block.id ? (
                      <div>
                        <textarea
                          className="travel-log-text-edit"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={5}
                          autoFocus
                        />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                          <button className="admin-btn primary" onClick={() => handleSaveText(block.id)}>
                            <Check size={14} /> {t('common.save')}
                          </button>
                          <button className="admin-btn secondary" onClick={() => { setEditingBlock(null); setEditText(''); }}>
                            <X size={14} /> {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="travel-log-block-text">
                        <p>{block.content}</p>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                          <button
                            className="travel-log-edit-btn"
                            onClick={() => { setEditingBlock(block.id); setEditText(block.content ?? ''); }}
                          >
                            <Pencil size={13} /> {t('common.edit')}
                          </button>
                          <button
                            className="travel-log-edit-btn"
                            style={{ color: 'var(--red-500)' }}
                            onClick={() => handleDeleteBlock(block.id)}
                          >
                            <Trash2 size={13} /> {t('common.delete')}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {block.type === 'photo' && block.imageUrl && (
                  <div className="travel-log-block-photo">
                    <img src={block.imageUrl} alt={block.caption ?? ''} loading="lazy" />
                    {block.caption && <div className="travel-log-caption">{block.caption}</div>}
                    <div style={{ marginTop: '6px' }}>
                      <button
                        className="travel-log-edit-btn"
                        style={{ color: 'var(--red-500)' }}
                        onClick={() => handleDeleteBlock(block.id)}
                      >
                        <Trash2 size={13} /> {t('common.delete')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      ) : (
        <div className="no-log-hint">
          {isHe
            ? 'אין יומן עדיין ליום זה. לחץ/י "ייצר עם AI" כדי להתחיל.'
            : 'No log yet for this day. Click "Generate with AI" to start.'}
        </div>
      )}

      {/* Add blocks */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
        <button className="travel-log-edit-btn" onClick={handleAddTextBlock}>
          <Plus size={14} /> {isHe ? 'הוסף טקסט' : 'Add Text Block'}
        </button>
        <button className="travel-log-edit-btn" onClick={() => photoInputRef.current?.click()}>
          <Image size={14} /> {isHe ? 'הוסף תמונה' : 'Add Photo'}
        </button>
      </div>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handlePhotoSelected}
      />
    </div>
  );
}
