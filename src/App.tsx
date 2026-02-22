import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TripProvider, useTripContext } from './context/TripContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import FlightsPage from './pages/FlightsPage';
import HotelsPage from './pages/HotelsPage';
import DrivingPage from './pages/DrivingPage';
import HighlightsPage from './pages/HighlightsPage';
import RestaurantsPage from './pages/RestaurantsPage';
import PassportPage from './pages/PassportPage';
import PhotosPage from './pages/PhotosPage';
import QuizPage from './pages/QuizPage';
import PackingPage from './pages/PackingPage';
import SettingsPage from './pages/SettingsPage';
import SetupPage from './pages/SetupPage';
import DiaryPage from './pages/DiaryPage';
import './i18n';

function AppRoutes() {
  const { tripCode, loading } = useTripContext();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '48px',
      }}>
        🇬🇷
      </div>
    );
  }

  if (!tripCode) {
    return (
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/flights" element={<FlightsPage />} />
        <Route path="/hotels" element={<HotelsPage />} />
        <Route path="/driving" element={<DrivingPage />} />
        <Route path="/highlights" element={<HighlightsPage />} />
        <Route path="/restaurants" element={<RestaurantsPage />} />
        <Route path="/passport" element={<PassportPage />} />
        <Route path="/photos" element={<PhotosPage />} />
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/packing" element={<PackingPage />} />
        <Route path="/diary" element={<DiaryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="/setup" element={<SetupPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <TripProvider>
          <AppRoutes />
        </TripProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
