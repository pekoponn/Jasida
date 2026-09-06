import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
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
import Footer from './components/Footer.jsx';
import brandLogo from './assets/brand-logo.png';

export default function App() {
  const { user, profile, signOut, loading } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const location = useLocation();

  if (location.pathname === '/login') {
    return <LoginPage />;
  }

  if (location.pathname === '/' && !loading && !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', userSelect: 'none', WebkitUserSelect: 'none' }}>
        <LandingPage />
        <Footer />
      </div>
    );
  }

  const isLandingOrFullWidth = location.pathname === '/';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', userSelect: 'none', WebkitUserSelect: 'none' }}>
      <header style={styles.header}>
        <div style={styles.brand}>
          <img src={brandLogo} alt="Jasida" style={{ height: 36 }} />
        </div>
        
        <nav style={styles.nav}>
          {isAdmin ? (
            <>
              <NavLink to="/admin" end style={navStyle}>Laporan</NavLink>
              <NavLink to="/admin/peta" style={navStyle}>Peta</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/" style={navStyle}>Beranda</NavLink>
              <NavLink to="/dashboard" style={navStyle}>Daftar Laporan</NavLink>
              <NavLink to="/lapor" style={navStyle}>Laporkan</NavLink>
            </>
          )}

          {user ? (
            <>
              <NavLink to="/profil" style={navStyle}>{profile?.username ?? 'Akun'}</NavLink>
              <button onClick={signOut} style={ctaPill}>
                Keluar
              </button>
            </>
          ) : (
            <NavLink to="/login" style={ctaPill}>Masuk / Daftar</NavLink>
          )}
        </nav>
      </header>

      <main 
        style={{ 
          flex: 1, 
          width: '100%', 
          maxWidth: isLandingOrFullWidth ? '100%' : 860, 
          margin: '0 auto', 
          padding: isLandingOrFullWidth ? 0 : '32px 20px 64px' 
        }}
      >
        <Routes>
          <Route path="/" element={<RoleRedirect />} />
          <Route path="/lapor" element={<ReportPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/peta" element={<MapPage />} />
          <Route path="/profil" element={<EditProfilePage />} />
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

      {}
      <Footer />
    </div>
  );
}

function navStyle({ isActive }) {
  return {
    padding: '8px 4px',
    fontWeight: 500,
    fontSize: 14,
    textDecoration: 'none',
    color: isActive ? '#A61C24' : '#333',
    cursor: 'pointer'
  };
}

const ctaPill = {
  fontSize: 14,
  fontWeight: 600,
  color: '#A61C24',
  background: '#FDECEE',
  padding: '10px 20px',
  borderRadius: 8,
  textDecoration: 'none',
  border: 'none',
  cursor: 'pointer',
  marginLeft: 16
};

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 6%',
    background: '#ffffff',
    borderBottom: '1.5px dashed #E5A3A3'
  },
  brand: { display: 'flex', alignItems: 'center' },
  nav: { display: 'flex', alignItems: 'center', gap: 24 }
};