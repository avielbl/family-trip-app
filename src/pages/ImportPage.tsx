import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shield, Loader } from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import BookingImport from '../components/BookingImport';

export default function ImportPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { config, tripCode, isAdmin } = useTripContext();
  const isHe = i18n.language === 'he';

  if (!isAdmin) {
    return (
      <div className="admin-page">
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <Shield size={40} style={{ marginBottom: '12px', color: 'var(--red-400)' }} />
          <p>{isHe ? 'גישה מוגבלת למנהל בלבד' : 'Admin access only'}</p>
          <button
            className="setup-btn secondary"
            onClick={() => navigate('/')}
            style={{ marginTop: '16px' }}
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  if (!config || !tripCode) {
    return (
      <div className="admin-page">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Loader size={40} className="spin" />
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <h2>{isHe ? 'ייבוא הזמנות' : 'Import Bookings'}</h2>
      <BookingImport
        tripCode={tripCode}
        startDate={config.startDate}
        endDate={config.endDate}
        onDone={() => navigate('/')}
      />
    </div>
  );
}
