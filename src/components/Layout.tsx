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
  Moon,
  Sun,
  BookOpen,
  Shield,
  CloudSun,
  Map,
  CalendarDays,
  MessageCircle,
  Luggage,
  ChevronDown,
  StickyNote,
} from 'lucide-react';
import { useState, useEffect, type ComponentType } from 'react';
import { useTripContext } from '../context/TripContext';
import ToastNotifications from './ToastNotifications';
import TripChatPanel from './TripChatPanel';

interface NavItem {
  path: string;
  icon: ComponentType<{ size?: number | string }>;
  labelKey?: string;
  label?: string;
}

const baseNavItems: NavItem[] = [
  { path: '/', icon: Home, labelKey: 'nav.home' },
  { path: '/itinerary', icon: CalendarDays, labelKey: 'nav.itinerary' },
  { path: '/weather', icon: CloudSun, labelKey: 'nav.weather' },
  { path: '/map', icon: Map, labelKey: 'nav.map' },
  { path: '/flights', icon: Plane, labelKey: 'nav.flights' },
  { path: '/hotels', icon: Hotel, labelKey: 'nav.hotels' },
  { path: '/driving', icon: Car, labelKey: 'nav.driving' },
  { path: '/highlights', icon: MapPin, labelKey: 'nav.highlights' },
  { path: '/restaurants', icon: UtensilsCrossed, labelKey: 'nav.restaurants' },
  { path: '/passport', icon: Stamp, labelKey: 'nav.passport' },
  { path: '/photos', icon: Camera, labelKey: 'nav.photos' },
  { path: '/quiz', icon: HelpCircle, labelKey: 'nav.quiz' },
  { path: '/packing', icon: CheckSquare, labelKey: 'nav.packing' },
  { path: '/travel-log', icon: BookOpen, labelKey: 'nav.travelLog' },
  { path: '/notes', icon: StickyNote, labelKey: 'nav.notes' },
  { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
];

export default function Layout() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Other pages can open the chat with a prepared prompt (tripit:chat-prompt).
  useEffect(() => {
    const openChat = () => setChatOpen(true);
    window.addEventListener('tripit:chat-prompt', openChat);
    return () => window.removeEventListener('tripit:chat-prompt', openChat);
  }, []);
  const isRTL = i18n.language === 'he';
  const isHe = i18n.language === 'he';
  const { isAdmin, config, isViewingActiveTrip, returnToActiveTrip } = useTripContext();

  const navItems: NavItem[] = [
    ...baseNavItems,
    { path: '/trips', icon: Luggage, label: isHe ? 'הטיולים שלנו' : 'Our Trips' },
    ...(isAdmin ? [{ path: '/admin', icon: Shield, labelKey: 'nav.admin' }] : []),
  ];
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

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
        <button
          className="top-title"
          onClick={() => navigate('/trips')}
          style={{
            background: 'none',
            border: 'none',
            fontFamily: 'inherit',
            color: 'inherit',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>
            {config?.flagEmoji ?? '✈️'} {config?.tripName ?? t('app.title')}
          </span>
          <ChevronDown size={16} />
        </button>
        <button
          className="menu-btn"
          onClick={() => setDarkMode(!darkMode)}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
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
      </header>

      {/* Non-active-trip banner */}
      {!isViewingActiveTrip && (
        <div
          style={{
            background: 'var(--amber-100, #fef3c7)',
            color: '#92400e',
            padding: '6px 12px',
            fontSize: 13,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>
            {isHe
              ? `צופים ב־${config?.tripName ?? ''}`
              : `Viewing ${config?.tripName ?? ''}`}
          </span>
          <button
            onClick={returnToActiveTrip}
            style={{
              background: 'none',
              border: 'none',
              color: '#92400e',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {isHe ? 'חזרה לטיול הפעיל' : 'Return to active trip'}
          </button>
        </div>
      )}

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
                <span>{item.labelKey ? t(item.labelKey) : item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Notifications */}
      <ToastNotifications />

      {/* AI Chat */}
      <TripChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />

      {/* Floating Chat Button */}
      <button
        className="chat-fab"
        onClick={() => setChatOpen((o) => !o)}
        aria-label="Open AI assistant"
      >
        {chatOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        {[
          { path: '/', icon: Home, labelKey: 'nav.home' },
          { path: '/itinerary', icon: CalendarDays, labelKey: 'nav.itinerary' },
          { path: '/weather', icon: CloudSun, labelKey: 'nav.weather' },
          { path: '/map', icon: Map, labelKey: 'nav.map' },
          { path: '/highlights', icon: MapPin, labelKey: 'nav.highlights' },
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
