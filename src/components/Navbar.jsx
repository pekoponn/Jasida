import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import brandLogo from '../assets/brand-logo.png';
import { useIsMobileDevice } from '../lib/useIsMobileDevice.js';

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isMobileDevice = useIsMobileDevice();
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    const node = headerRef.current;
    if (!node) return;
    const update = () => setHeaderHeight(node.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [isMobileDevice]);

  return (
    <>
      {/* 1. NAVBAR DESKTOP */}
      {!isMobileDevice && (
        <>
          <header
            ref={headerRef}
            className="rw-header-desktop"
            style={{ ...styles.header, position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000 }}
          >
            <div style={styles.brand}>
              <img src={brandLogo} alt="Jasida" style={{ height: 50 }} />
            </div>

            <nav style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              {isAdmin ? (
                <>
                  <NavLink to="/admin" end style={navStyle}>
                    Laporan
                  </NavLink>
                  <NavLink to="/admin/peta" style={navStyle}>
                    Peta
                  </NavLink>
                </>
              ) : (
                <>
                  <NavLink to="/" style={navStyle}>
                    Beranda
                  </NavLink>
                  <NavLink to="/dashboard" style={navStyle}>
                    Daftar Laporan
                  </NavLink>
                  <NavLink to="/lapor" style={navStyle}>
                    Laporkan
                  </NavLink>
                </>
              )}

              {user ? (
                <ProfileDropdown profile={profile} signOut={signOut} />
              ) : (
                <NavLink to="/login" style={ctaPill}>
                  Masuk / Daftar
                </NavLink>
              )}
            </nav>
          </header>
          <div style={{ height: headerHeight }} />
        </>
      )}

      {/* 2b. TOP BAR MOBILE — cuma logo, tanpa tombol */}
      {isMobileDevice && (
        <>
          <header
            ref={headerRef}
            className="rw-header-mobile"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 1000,
              background: '#ffffff',
            }}
          >
            <img src={brandLogo} alt="Jasida" style={{ height: 40 }} />
          </header>
          <div style={{ height: headerHeight }} />
        </>
      )}

      {/* 2. MOBILE BOTTOM NAVBAR */}
      {isMobileDevice && (
        <nav className="rw-mobile-bottom-nav">
          {isAdmin ? (
            <>
              <NavLink
                to="/admin"
                end
                className={({ isActive }) => `rw-bottom-item ${isActive ? 'active' : ''}`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                </svg>
                <span>Laporan</span>
              </NavLink>
              <NavLink
                to="/admin/peta"
                className={({ isActive }) => `rw-bottom-item ${isActive ? 'active' : ''}`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                <span>Peta</span>
              </NavLink>
            </>
          ) : (
            <>
              <NavLink
                to="/"
                end
                className={({ isActive }) => `rw-bottom-item ${isActive ? 'active' : ''}`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                </svg>
                <span>Beranda</span>
              </NavLink>
              <NavLink
                to="/dashboard"
                className={({ isActive }) => `rw-bottom-item ${isActive ? 'active' : ''}`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                </svg>
                <span>Laporan</span>
              </NavLink>
              <NavLink
                to="/lapor"
                className={({ isActive }) => `rw-bottom-item ${isActive ? 'active' : ''}`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
                </svg>
                <span>Lapor</span>
              </NavLink>
            </>
          )}

          <NavLink
            to={user ? '/profil' : '/login'}
            className={({ isActive }) => `rw-bottom-item ${isActive ? 'active' : ''}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
            <span>{user ? 'Akun' : 'Masuk'}</span>
          </NavLink>
        </nav>
      )}
    </>
  );
}

/** Dropdown nama user di navbar desktop: Profil, Riwayat, Keluar */
function ProfileDropdown({ profile, signOut }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function go(path) {
    setOpen(false);
    navigate(path);
  }

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    navigate('/');
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <style>{profileTriggerHoverCss}</style>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rw-profile-trigger"
        style={profileTrigger}
      >
        <UserIcon />
        {profile?.username ?? 'Akun'}
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div style={dropdownMenu}>
          <button type="button" style={dropdownItem} onClick={() => go('/profil')}>
            <UserIcon small /> Profil
          </button>
          <button type="button" style={dropdownItem} onClick={() => go('/riwayat')}>
            <HistoryIcon /> Riwayat
          </button>
          <div style={dropdownDivider} />
          <button
            type="button"
            style={{ ...dropdownItem, color: '#A61C24' }}
            onClick={handleSignOut}
          >
            <LogoutIcon /> Keluar
          </button>
        </div>
      )}
    </div>
  );
}

function UserIcon({ small }) {
  const size = small ? 16 : 17;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6" strokeLinecap="round" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" />
      <polyline points="3 3 3 9 9 9" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="12 8 12 12 15 14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline points="16 17 21 12 16 7" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
    >
      <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function navStyle({ isActive }) {
  return {
    padding: '8px 4px',
    fontWeight: 500,
    fontSize: 14,
    textDecoration: 'none',
    color: isActive ? '#A61C24' : '#333',
    cursor: 'pointer',
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
  marginLeft: 16,
};

const profileTrigger = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
  fontWeight: 600,
  color: '#333',
  background: 'transparent',
  padding: '8px 4px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  marginLeft: 16,
};

const profileTriggerHoverCss = `
  .rw-profile-trigger:hover {
    color: #A61C24;
  }
`;
const dropdownMenu = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  right: 0,
  minWidth: 170,
  background: '#fff',
  borderRadius: 10,
  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
  border: '1px solid #eee',
  padding: 6,
  zIndex: 50,
};

const dropdownItem = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '10px 12px',
  fontSize: 14,
  fontWeight: 500,
  color: '#333',
  background: 'none',
  border: 'none',
  borderRadius: 6,
  textAlign: 'left',
  cursor: 'pointer',
};

const dropdownDivider = {
  height: 1,
  background: '#eee',
  margin: '4px 4px',
};

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 6%',
    background: '#ffffff',
  },
  brand: { display: 'flex', alignItems: 'center' },
};
