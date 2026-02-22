import React, { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Clock, Ticket, CheckCircle, Circle, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTripContext } from '../context/TripContext';
import { toggleHighlightComplete } from '../firebase/tripService';
import type { Highlight, HighlightCategory } from '../types/trip';

const CATEGORY_EMOJIS: Record<HighlightCategory, string> = {
  beach: '\u{1F3D6}\u{FE0F}',
  ruins: '\u{1F3DB}\u{FE0F}',
  museum: '\u{1F3FA}',
  food: '\u{1F37D}\u{FE0F}',
  'kids-fun': '\u{1F3A1}',
  nature: '\u{1F33F}',
  shopping: '\u{1F6CD}\u{FE0F}',
  viewpoint: '\u{1F305}',
  other: '\u{1F4CC}',
};

const ALL_CATEGORIES: HighlightCategory[] = [
  'beach',
  'ruins',
  'museum',
  'food',
  'kids-fun',
  'nature',
  'shopping',
  'viewpoint',
  'other',
];

const HighlightsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { highlights, tripCode, currentMember, days, config } = useTripContext();
  const [selectedCategory, setSelectedCategory] = useState<HighlightCategory | 'all'>('all');

  const isHebrew = i18n.language === 'he';

  const getHighlightName = (highlight: Highlight) => {
    if (isHebrew && highlight.nameHe) return highlight.nameHe;
    return highlight.name;
  };

  const getHighlightDescription = (highlight: Highlight) => {
    if (isHebrew && highlight.descriptionHe) return highlight.descriptionHe;
    return highlight.description;
  };

  const getMapUrl = (highlight: Highlight) => {
    if (highlight.mapUrl) return highlight.mapUrl;
    if (highlight.address) {
      const query = encodeURIComponent(highlight.address);
      return `https://www.google.com/maps/search/?api=1&query=${query}`;
    }
    return null;
  };

  const filteredHighlights = useMemo(() => {
    if (selectedCategory === 'all') return highlights;
    return highlights.filter((h) => h.category === selectedCategory);
  }, [highlights, selectedCategory]);

  const highlightsByDay = useMemo(() => {
    const grouped = new Map<number, Highlight[]>();
    const sorted = [...filteredHighlights].sort((a, b) => a.dayIndex - b.dayIndex);
    for (const highlight of sorted) {
      const existing = grouped.get(highlight.dayIndex) || [];
      existing.push(highlight);
      grouped.set(highlight.dayIndex, existing);
    }
    return grouped;
  }, [filteredHighlights]);

  const getDayLabel = (dayIndex: number) => {
    const day = days.find((d) => d.dayIndex === dayIndex);
    if (day) {
      try {
        const dateStr = format(parseISO(day.date), 'MMM d');
        return `${t('common.day')} ${dayIndex + 1} - ${dateStr}`;
      } catch {
        return `${t('common.day')} ${dayIndex + 1}`;
      }
    }
    return `${t('common.day')} ${dayIndex + 1}`;
  };

  const handleToggleComplete = useCallback(
    async (highlight: Highlight) => {
      if (!tripCode || !currentMember) return;
      const isCompletedByMe = highlight.completedBy?.includes(currentMember.id) ?? false;
      await toggleHighlightComplete(tripCode, highlight.id, currentMember.id, !isCompletedByMe);
    },
    [tripCode, currentMember]
  );

  const getMemberName = (memberId: string) => {
    const member = config?.familyMembers.find((m) => m.id === memberId);
    if (!member) return memberId;
    return isHebrew ? member.nameHe : member.name;
  };

  return (
    <div className="highlights-page">
      <h1>{t('highlights.title')}</h1>

      <div className="category-filter">
        <button
          className={`category-tab ${selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('all')}
        >
          {t('highlights.allCategories')}
        </button>
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`category-tab ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            <span className="category-emoji">{CATEGORY_EMOJIS[cat]}</span>
            <span>{t(`highlights.categories.${cat}`)}</span>
          </button>
        ))}
      </div>

      {Array.from(highlightsByDay.entries()).map(([dayIndex, dayHighlights]) => (
        <div key={dayIndex} className="highlights-day-group">
          <h3>{getDayLabel(dayIndex)}</h3>

          {dayHighlights.map((highlight) => {
            const isCompletedByMe =
              currentMember && highlight.completedBy?.includes(currentMember.id);
            const mapUrl = getMapUrl(highlight);
            const description = getHighlightDescription(highlight);

            return (
              <div
                key={highlight.id}
                className={`highlight-card ${highlight.completed ? 'highlight-completed' : ''}`}
              >
                {highlight.imageUrl && (
                  <div className="highlight-image">
                    <img src={highlight.imageUrl} alt={getHighlightName(highlight)} loading="lazy" />
                  </div>
                )}

                <div className="highlight-card-content">
                  <div className="highlight-header">
                    <span className="category-emoji">{CATEGORY_EMOJIS[highlight.category]}</span>
                    <h4 className="highlight-name">{getHighlightName(highlight)}</h4>
                  </div>

                  {description && (
                    <p className="highlight-description">{description}</p>
                  )}

                  <div className="highlight-info">
                    {highlight.openingHours && (
                      <div className="highlight-info-item">
                        <Clock size={14} />
                        <span className="info-label">{t('highlights.openingHours')}:</span>
                        <span>{highlight.openingHours}</span>
                      </div>
                    )}

                    {highlight.ticketInfo && (
                      <div className="highlight-info-item">
                        <Ticket size={14} />
                        <span className="info-label">{t('highlights.tickets')}:</span>
                        <span>{highlight.ticketInfo}</span>
                      </div>
                    )}

                    {highlight.address && (
                      <div className="highlight-info-item">
                        <MapPin size={14} />
                        <span>{highlight.address}</span>
                        {mapUrl && (
                          <a
                            href={mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="map-link"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {highlight.completedBy && highlight.completedBy.length > 0 && (
                    <div className="highlight-visited-by">
                      <CheckCircle size={14} />
                      <span>
                        {t('highlights.visited')}: {highlight.completedBy.map(getMemberName).join(', ')}
                      </span>
                    </div>
                  )}

                  <button
                    className={`visit-btn ${isCompletedByMe ? 'visited' : ''}`}
                    onClick={() => handleToggleComplete(highlight)}
                  >
                    {isCompletedByMe ? (
                      <>
                        <CheckCircle size={16} />
                        <span>{t('highlights.markUndone')}</span>
                      </>
                    ) : (
                      <>
                        <Circle size={16} />
                        <span>{t('highlights.markDone')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default HighlightsPage;
