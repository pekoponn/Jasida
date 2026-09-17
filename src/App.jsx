import { lazy, Suspense, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import RoleRedirect from './components/RoleRedirect.jsx';
import AdminRoute from './components/AdminRoute.jsx';
import AdminSidebar from './components/AdminSidebar.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import { useAuth } from './lib/AuthContext.jsx';
import Footer from './components/Footer.jsx';
import Navbar from './components/Navbar.jsx';
import { useIsMobileDevice } from './lib/useIsMobileDevice.js';
import AdminTopbar from './components/AdminTopbar.jsx';

const ADMIN_SIDEBAR_WIDTH = 260;
const ReportPage = lazy(() => import('./pages/ReportPage.jsx'));
const MapPage = lazy(() => import('./pages/MapPage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage.jsx'));
const AdminKelolaLaporanPage = lazy(() => import('./pages/AdminKelolaLaporanPage.jsx'));
const AdminDoubleCheckPage = lazy(() => import('./pages/AdminDoubleCheckPage.jsx'));
const AdminPenggunaPage = lazy(() => import('./pages/AdminPenggunaPage.jsx'));
const AdminStatistikPage = lazy(() => import('./pages/AdminStatistikPage.jsx'));
const EditProfilePage = lazy(() => import('./pages/EditProfilePage.jsx'));
const RiwayatPage = lazy(() => import('./pages/RiwayatPage.jsx'));

export default function App() {
  return <Suspense fallback={<p role="status" style={{ padding: 24 }}>Memuat halaman…</p>}><AppContent /></Suspense>;
}

function AppContent() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const location = useLocation();
  const isMobileDevice = useIsMobileDevice();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (location.pathname === '/login') {
    return (
      <>
        <ScrollToTop />
        <LoginPage />
      </>
    );
  }

  const isAdminArea = location.pathname.startsWith('/admin');

  if (isAdminArea) {
    return (
      <div style={{ minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
        <ScrollToTop />
        <AdminSidebar
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div
          style={{
            marginLeft: isMobileDevice ? 0 : ADMIN_SIDEBAR_WIDTH,
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: '#F5F6FA'
          }}
        >
          <div style={{ position: 'sticky', top: 0, zIndex: 90 }}>
            <AdminTopbar onMenuClick={() => setSidebarOpen(true)} />
          </div>
          <main style={{ flex: 1, padding: '28px 32px 64px' }}>
            <Routes>
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
              <Route
                path="/admin/laporan"
                element={
                  <AdminRoute>
                    <AdminKelolaLaporanPage />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/double-check"
                element={
                  <AdminRoute>
                    <AdminDoubleCheckPage />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/pengguna"
                element={
                  <AdminRoute>
                    <AdminPenggunaPage />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/profil"
                element={
                  <AdminRoute>
                    <EditProfilePage />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/statistik"
                element={
                  <AdminRoute>
                    <AdminStatistikPage />
                  </AdminRoute>
                }
              />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    );
  }

  const isLandingOrFullWidth = location.pathname === '/' || location.pathname === '/dashboard';
  const isReportPage = location.pathname === '/lapor' || location.pathname === '/riwayat';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', userSelect: 'none', WebkitUserSelect: 'none' }}>
      <ScrollToTop />

      {/* NAVBAR KOMPONEN BARU */}
      <Navbar />

      <div style={dashedDivider()} />

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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {!isMobileDevice && <Footer />}
    </div>
  );
}

function dashedDivider() {
  const color = '#C9C9C9';
  return {
    height: 3,
    width: '100%',
    backgroundImage: `repeating-linear-gradient(90deg, ${color} 0, ${color} 10px, transparent 10px, transparent 18px)`
  };
}
