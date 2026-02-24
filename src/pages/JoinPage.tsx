import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogIn, Loader, AlertCircle, Smartphone } from 'lucide-react';
import { useAuthContext } from '../context/AuthContext';
import { useTripContext } from '../context/TripContext';

export default function JoinPage() {
  const { tripCode: codeParam } = useParams<{ tripCode: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { firebaseUser, signInWithGoogle, authLoading } = useAuthContext();
  const { setTripCode, tripCode: activeTripCode } = useTripContext();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const isHe = i18n.language === 'he';

  // After sign-in, auto-join the trip
  useEffect(() => {
    if (!firebaseUser || !codeParam) return;
    if (activeTripCode === codeParam) {
      navigate('/');
      return;
    }
    setJoining(true);
    setTripCode(codeParam).then((ok) => {
      if (ok) {
        navigate('/');
      } else {
        setError(isHe ? 'קוד טיול לא תקין' : 'Invalid trip code');
      }
      setJoining(false);
    });
  }, [firebaseUser, codeParam]);

  if (authLoading || joining) {
    return (
      <div className="join-page">
        <Loader size={40} className="spin" />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="join-page">
      <div className="join-hero">
        <div className="setup-emoji">🇬🇷</div>
        <h1>{t('app.title')}</h1>
        <p className="join-subtitle">
          {isHe ? 'הוזמנת להצטרף לטיול המשפחתי!' : "You've been invited to join the family trip!"}
        </p>
      </div>

      {error && (
        <p className="setup-error">
          <AlertCircle size={16} /> {error}
        </p>
      )}

      {!firebaseUser ? (
        <div className="join-actions">
          <p className="join-hint">
            {isHe
              ? 'התחבר עם גוגל כדי להצטרף לטיול'
              : 'Sign in with Google to join the trip'}
          </p>
          <button className="google-signin-btn" onClick={signInWithGoogle}>
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
            </svg>
            {isHe ? 'התחבר עם Google' : 'Sign in with Google'}
          </button>

          <div className="join-divider">
            <span>{isHe ? 'או' : 'or'}</span>
          </div>

          <button
            className="setup-btn secondary"
            onClick={() => {
              if (codeParam) {
                setTripCode(codeParam).then((ok) => {
                  if (ok) navigate('/');
                  else setError(isHe ? 'קוד טיול לא תקין' : 'Invalid trip code');
                });
              }
            }}
          >
            <LogIn size={16} />
            {isHe ? 'המשך ללא כניסה' : 'Continue without signing in'}
          </button>
        </div>
      ) : (
        <div className="join-actions">
          <p>{isHe ? 'מצטרפ/ת לטיול...' : 'Joining the trip...'}</p>
        </div>
      )}

      {/* Add to Home Screen instructions */}
      <div className="join-pwa-hint">
        <Smartphone size={16} />
        <span>
          {isHe
            ? 'להוסיף לבית: לחצ/י על Share ← "הוסף למסך הבית"'
            : 'Add to home screen: tap Share → "Add to Home Screen"'}
        </span>
      </div>
    </div>
  );
}
