import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Home,
  Plane,
  Hotel,
  Car,
  MapPin,
  UtensilsCrossed,
  Stamp,
  Camera,
  HelpCircle,
  CheckSquare,
  Settings,
  Menu,
  X,
  BookOpen,
  Moon,
  Sun,
} from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';

const navItems = [
  { path: '/', icon: Home, labelKey: 'nav.home' },
  { path: '/flights', icon: Plane, labelKey: 'nav.flights' },
  { path: '/hotels', icon: Hotel, labelKey: 'nav.hotels' },
  { path: '/driving', icon: Car, labelKey: 'nav.driving' },
  { path: '/highlights', icon: MapPin, labelKey: 'nav.highlights' },
  { path: '/restaurants', icon: UtensilsCrossed, labelKey: 'nav.restaurants' },
  { path: '/passport', icon: Stamp, labelKey: 'nav.passport' },
  { path: '/photos', icon: Camera, labelKey: 'nav.photos' },
  { path: '/quiz', icon: HelpCircle, labelKey: 'nav.quiz' },
  { path: '/packing', icon: CheckSquare, labelKey: 'nav.packing' },
  { path: '/diary', icon: BookOpen, labelKey: 'nav.diary' },
  { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
];

export default function Layout() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isRTL = i18n.language === 'he';
  const { isDark, toggleDark } = useTheme();

  return (
    <div
      className="app-container"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ fontFamily: isRTL ? '"Heebo", sans-serif' : '"Inter", sans-serif' }}
    >
      {/* Top Bar */}
      <header className="top-bar">
        <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <h1 className="top-title">{t('app.title')}</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="menu-btn"
            onClick={toggleDark}
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="lang-btn"
            onClick={() => {
              const newLang = i18n.language === 'he' ? 'en' : 'he';
              i18n.changeLanguage(newLang);
              localStorage.setItem('tripLang', newLang);
            }}
          >
            {i18n.language === 'he' ? 'EN' : 'עב'}
          </button>
        </div>
      </header>

      {/* Side Menu */}
      {menuOpen && (
        <div className="menu-overlay" onClick={() => setMenuOpen(false)}>
          <nav
            className={`side-menu ${isRTL ? 'side-menu-rtl' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            {navItems.map((item) => (
              <button
                key={item.path}
                className={`menu-item ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => {
                  navigate(item.path);
                  setMenuOpen(false);
                }}
              >
                <item.icon size={20} />
                <span>{t(item.labelKey)}</span>
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        {[
          { path: '/', icon: Home, labelKey: 'nav.home' },
          { path: '/flights', icon: Plane, labelKey: 'nav.flights' },
          { path: '/highlights', icon: MapPin, labelKey: 'nav.highlights' },
          { path: '/photos', icon: Camera, labelKey: 'nav.photos' },
          { path: '/passport', icon: Stamp, labelKey: 'nav.passport' },
        ].map((item) => (
          <button
            key={item.path}
            className={`bottom-nav-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <item.icon size={20} />
            <span>{t(item.labelKey)}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
