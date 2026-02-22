import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plane, Clock, MapPin, Terminal, Hash, FileText, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTripContext } from '../context/TripContext';

const FlightsPage: React.FC = () => {
  const { t } = useTranslation();
  const { flights } = useTripContext();

  const sortedFlights = useMemo(() => {
    return [...flights].sort(
      (a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime()
    );
  }, [flights]);

  const formatTime = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'HH:mm');
    } catch {
      return dateStr;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'EEE, MMM d');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flights-page">
      <h1>{t('flights.title')}</h1>

      <div className="flights-list">
        {sortedFlights.map((flight) => (
          <div key={flight.id} className="flight-card">
            <div className="flight-card-header">
              <div className="airline-logo-placeholder">
                <Plane size={24} />
              </div>
              <div className="flight-header-info">
                <span className="flight-airline">{flight.airline}</span>
                <span className="flight-number">{flight.flightNumber}</span>
              </div>
              <div className="flight-date">
                {formatDate(flight.departureTime)}
              </div>
            </div>

            <div className="flight-route">
              <div className="flight-endpoint departure">
                <span className="airport-code">{flight.departureAirportCode}</span>
                <span className="airport-name">{flight.departureAirport}</span>
                <div className="flight-time">
                  <Clock size={14} />
                  <span>{formatTime(flight.departureTime)}</span>
                </div>
              </div>

              <div className="flight-route-line">
                <div className="route-line" />
                <Plane size={16} className="route-plane-icon" />
                <div className="route-line" />
              </div>

              <div className="flight-endpoint arrival">
                <span className="airport-code">{flight.arrivalAirportCode}</span>
                <span className="airport-name">{flight.arrivalAirport}</span>
                <div className="flight-time">
                  <Clock size={14} />
                  <span>{formatTime(flight.arrivalTime)}</span>
                </div>
              </div>
            </div>

            <div className="flight-details">
              {flight.terminal && (
                <div className="flight-detail-item">
                  <Terminal size={14} />
                  <span className="detail-label">{t('flights.terminal')}:</span>
                  <span className="detail-value">{flight.terminal}</span>
                </div>
              )}

              {flight.gate && (
                <div className="flight-detail-item">
                  <MapPin size={14} />
                  <span className="detail-label">{t('flights.gate')}:</span>
                  <span className="detail-value">{flight.gate}</span>
                </div>
              )}

              {flight.confirmationCode && (
                <div className="flight-detail-item">
                  <Hash size={14} />
                  <span className="detail-label">{t('flights.confirmation')}:</span>
                  <span className="detail-value confirmation-code">
                    {flight.confirmationCode}
                  </span>
                </div>
              )}

              {flight.notes && (
                <div className="flight-detail-item">
                  <FileText size={14} />
                  <span className="detail-value flight-notes">{flight.notes}</span>
                </div>
              )}
            </div>

            {flight.boardingPassUrl && (
              <a
                href={flight.boardingPassUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="boarding-pass-link"
              >
                <ExternalLink size={14} />
                <span>{t('flights.boardingPass')}</span>
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FlightsPage;
