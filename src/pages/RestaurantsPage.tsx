import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UtensilsCrossed, Star, MapPin, Phone, ExternalLink, DollarSign } from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import { rateRestaurant } from '../firebase/tripService';

type FilterTab = 'all' | 'visited' | 'notVisited';

const RestaurantsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { restaurants, tripCode, currentMember } = useTripContext();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [hoveredStars, setHoveredStars] = useState<Record<string, number>>({});

  const isHebrew = i18n.language === 'he';

  const filteredRestaurants = restaurants.filter((restaurant) => {
    if (activeFilter === 'visited') return restaurant.visited;
    if (activeFilter === 'notVisited') return !restaurant.visited;
    return true;
  });

  const getAverageRating = (ratings: Record<string, number>): number => {
    const values = Object.values(ratings);
    if (values.length === 0) return 0;
    return values.reduce((sum, r) => sum + r, 0) / values.length;
  };

  const handleRate = async (restaurantId: string, rating: number) => {
    if (!currentMember) return;
    await rateRestaurant(tripCode!, restaurantId, currentMember.id, rating);
  };

  const handleNavigate = (restaurant: { mapUrl?: string; name: string; city?: string }) => {
    if (restaurant.mapUrl) {
      window.open(restaurant.mapUrl, '_blank', 'noopener,noreferrer');
    } else {
      const query = encodeURIComponent(`${restaurant.name}${restaurant.city ? `, ${restaurant.city}` : ''}, Greece`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank', 'noopener,noreferrer');
    }
  };

  const renderPriceRange = (priceRange?: '$' | '$$' | '$$$') => {
    if (!priceRange) return null;
    return (
      <span className="restaurant-price">
        {priceRange.split('').map((_, idx) => (
          <DollarSign key={idx} size={14} />
        ))}
      </span>
    );
  };

  const renderStarRating = (restaurantId: string) => {
    const currentRating = currentMember
      ? restaurants.find((r) => r.id === restaurantId)?.ratings[currentMember.id] || 0
      : 0;
    const hovered = hoveredStars[restaurantId] || 0;

    return (
      <div className="star-rating">
        {[1, 2, 3, 4, 5].map((starValue) => (
          <button
            key={starValue}
            className={`star ${starValue <= (hovered || currentRating) ? 'star-filled' : ''}`}
            onClick={() => handleRate(restaurantId, starValue)}
            onMouseEnter={() => setHoveredStars((prev) => ({ ...prev, [restaurantId]: starValue }))}
            onMouseLeave={() => setHoveredStars((prev) => ({ ...prev, [restaurantId]: 0 }))}
            aria-label={`${t('restaurants.rate')} ${starValue}`}
          >
            <Star
              size={20}
              fill={starValue <= (hovered || currentRating) ? '#f59e0b' : 'none'}
              stroke={starValue <= (hovered || currentRating) ? '#f59e0b' : '#d1d5db'}
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="restaurants-page" dir={isHebrew ? 'rtl' : 'ltr'}>
      <div className="page-header">
        <UtensilsCrossed size={28} />
        <h1>{t('restaurants.title')}</h1>
      </div>

      <div className="filter-tabs">
        <button
          className={`filter-tab ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          {t('restaurants.visited').replace(/.*/, 'All')}
        </button>
        <button
          className={`filter-tab ${activeFilter === 'visited' ? 'active' : ''}`}
          onClick={() => setActiveFilter('visited')}
        >
          {t('restaurants.visited')}
        </button>
        <button
          className={`filter-tab ${activeFilter === 'notVisited' ? 'active' : ''}`}
          onClick={() => setActiveFilter('notVisited')}
        >
          {t('restaurants.notVisited')}
        </button>
      </div>

      <div className="restaurants-list">
        {filteredRestaurants.map((restaurant) => {
          const avgRating = getAverageRating(restaurant.ratings);
          const displayName = isHebrew && restaurant.nameHe ? restaurant.nameHe : restaurant.name;

          return (
            <div key={restaurant.id} className={`restaurant-card ${restaurant.visited ? 'visited' : ''}`}>
              <div className="restaurant-header">
                <h2 className="restaurant-name">{displayName}</h2>
                {restaurant.visited && (
                  <span className="visited-badge">{t('restaurants.visited')}</span>
                )}
              </div>

              <div className="restaurant-meta">
                {restaurant.cuisine && (
                  <span className="meta-item cuisine">
                    <UtensilsCrossed size={14} />
                    {t('restaurants.cuisine')}: {restaurant.cuisine}
                  </span>
                )}
                {restaurant.priceRange && (
                  <span className="meta-item price">
                    {t('restaurants.priceRange')}: {renderPriceRange(restaurant.priceRange)}
                  </span>
                )}
                {restaurant.city && (
                  <span className="meta-item city">
                    <MapPin size={14} />
                    {restaurant.city}
                  </span>
                )}
                {restaurant.address && (
                  <span className="meta-item address">{restaurant.address}</span>
                )}
              </div>

              <div className="restaurant-rating-section">
                <div className="your-rating">
                  <span className="rating-label">{t('restaurants.rate')}:</span>
                  {renderStarRating(restaurant.id)}
                </div>
                {avgRating > 0 && (
                  <div className="avg-rating">
                    <Star size={16} fill="#f59e0b" stroke="#f59e0b" />
                    <span>{t('restaurants.avgRating', { rating: avgRating.toFixed(1) })}</span>
                  </div>
                )}
              </div>

              {restaurant.notes && (
                <p className="restaurant-notes">{restaurant.notes}</p>
              )}

              <div className="restaurant-actions">
                <button className="action-btn navigate-btn" onClick={() => handleNavigate(restaurant)}>
                  <ExternalLink size={16} />
                  {t('restaurants.navigate')}
                </button>
                {restaurant.phone && (
                  <a href={`tel:${restaurant.phone}`} className="action-btn phone-btn">
                    <Phone size={16} />
                    {restaurant.phone}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RestaurantsPage;
