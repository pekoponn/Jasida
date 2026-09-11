import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ReportPage from './pages/ReportPage.jsx';
import MapPage from './pages/MapPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import LandingPage from './pages/LandingPage.jsx';
import AdminDashboardPage from './pages/AdminDashboardPage.jsx';
import RoleRedirect from './components/RoleRedirect.jsx';
import AdminRoute from './components/AdminRoute.jsx';
import { useAuth } from './lib/AuthContext.jsx';
import EditProfilePage from './pages/EditProfilePage.jsx';
import RiwayatPage from './pages/RiwayatPage.jsx';
import Footer from './components/Footer.jsx';
import Navbar from './components/Navbar.jsx';
import { useIsMobileDevice } from './lib/useIsMobileDevice.js';

export default function App() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const location = useLocation();
  const isMobileDevice = useIsMobileDevice();

  if (location.pathname === '/login') {
    return <LoginPage />;
  }

  const isLandingOrFullWidth = location.pathname === '/' || location.pathname === '/dashboard';
  const isReportPage = location.pathname === '/lapor' || location.pathname === '/riwayat';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', userSelect: 'none', WebkitUserSelect: 'none' }}>
      
      {/* NAVBAR KOMPONEN BARU */}
      <Navbar />

      <div style={dashedDivider} />

      <main
          style={{
            flex: 1,
            width: '100%',
            maxWidth: isLandingOrFullWidth || isReportPage ? '100%' : 860,
            margin: '0 auto',
            padding: isLandingOrFullWidth ? 0 : isReportPage ? '32px 6% 64px' : '32px 20px 64px',
            paddingBottom: isMobileDevice ? 80 : (isLandingOrFullWidth ? 0 : 64)
          }}
        >
        <Routes>
          <Route path="/" element={isAdmin ? <Navigate to="/admin" replace /> : <LandingPage />} />
          <Route path="/redirect" element={<RoleRedirect />} />
          <Route path="/lapor" element={<ReportPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/peta" element={<MapPage />} />
          <Route path="/profil" element={<EditProfilePage />} />
          <Route path="/riwayat" element={<RiwayatPage />} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboardPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/peta"
            element={
              <AdminRoute>
                <AdminDashboardPage />
              </AdminRoute>
            }
          />
        </Routes>
      </main>

      {!isMobileDevice && <Footer />}
    </div>
  );
}

const dashedDivider = {
  height: 3,
  width: '100%',
  backgroundImage: 'repeating-linear-gradient(90deg, #E5A3A3 0, #E5A3A3 10px, transparent 10px, transparent 18px)'
};