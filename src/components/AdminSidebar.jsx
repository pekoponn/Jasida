import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  Map,
  BarChart3,
  Users,
  X,
  ShieldCheck,
} from 'lucide-react';
import jasidaLogo from '../assets/jasida-logo-white.png';
import { countPendingReviews } from '../lib/reports.js';

const MENU = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/laporan', label: 'Kelola Laporan', icon: ClipboardList },
  { to: '/admin/verifikasi', label: 'Verifikasi Laporan', icon: ShieldCheck, badge: true },
  { to: '/admin/peta', label: 'Peta Laporan', icon: Map },
  { to: '/admin/statistik', label: 'Statistik', icon: BarChart3 },
  { to: '/admin/pengguna', label: 'Pengguna', icon: Users },
];

const REFRESH_MS = 30000;

export default function AdminSidebar({ mobileOpen = false, onClose }) {
  const location = useLocation();
  const [pendingTotal, setPendingTotal] = useState(0);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [mobileOpen]);

  // Jumlah yang harus diverifikasi: double check + lokasi yang ditahan.
  // Diperbarui saat pindah halaman, tiap 30 detik, saat tab kembali aktif,
  // dan saat admin selesai memproses satu item ('reviews-changed').
  useEffect(() => {
    let active = true;
    const refresh = () =>
      countPendingReviews()
        .then((c) => active && setPendingTotal(c.duplicate + c.location))
        .catch((err) => console.warn('[sidebar-badge]', err.message));

    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    window.addEventListener('reviews-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('reviews-changed', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [location.pathname]);

  return (
    <>
      <style>{sidebarCss}</style>

      {mobileOpen && <div className="admin-sidebar-backdrop" onClick={onClose} />}

      <aside className={`admin-sidebar${mobileOpen ? ' admin-sidebar-open' : ''}`} style={sidebar}>
        <div style={logoRow}>
          <img src={jasidaLogo} alt="Jasida" style={{ height: 36 }} />
          <span style={brandText}>Jasida</span>
          <button
            onClick={onClose}
            className="admin-sidebar-close"
            style={closeBtn}
            aria-label="Tutup menu"
          >
            <X size={20} color="#fff" />
          </button>
        </div>

        <nav style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {MENU.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              style={({ isActive }) => itemStyle(isActive)}
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} />
                  <span>{label}</span>
                  {badge && pendingTotal > 0 && (
                    <span
                      className="admin-badge"
                      style={isActive ? badgeActive : badgeInactive}
                      aria-label={`${pendingTotal} laporan menunggu verifikasi`}
                    >
                      {pendingTotal > 99 ? '99+' : pendingTotal}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}

const sidebarCss = `
  .admin-sidebar-close { display: none; }
  .admin-sidebar-backdrop { display: none; }

  @keyframes admin-badge-pulse {
    0%   { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.6); }
    70%  { box-shadow: 0 0 0 7px rgba(255, 77, 79, 0); }
    100% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0); }
  }
  .admin-badge { animation: admin-badge-pulse 1.8s ease-out infinite; }
  @media (prefers-reduced-motion: reduce) {
    .admin-badge { animation: none; }
  }

  @media (max-width: 900px) {
    .admin-sidebar {
      position: fixed !important;
      top: 0;
      left: 0;
      height: 100vh;
      /* Leaflet nge-set kontrolnya (tombol zoom, popup, dll) sampai z-index: 1000,
         jadi sidebar & backdrop harus di atas itu supaya nggak ketembus peta. */
      z-index: 2000;
      transform: translateX(-105%);
      transition: transform 0.25s ease;
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.35);
    }
    .admin-sidebar-open {
      transform: translateX(0) !important;
    }
    .admin-sidebar-close {
      display: flex !important;
      margin-left: auto;
      background: transparent;
      border: none;
      cursor: pointer;
    }
    .admin-sidebar-backdrop {
      display: block !important;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      z-index: 1900;
    }
  }
`;

const sidebar = {
  width: 260,
  height: '100vh',
  position: 'fixed',
  top: 0,
  left: 0,
  overflowY: 'auto',
  background: '#141B2E',
  padding: '28px 16px',
  flexShrink: 0,
  zIndex: 2000,
};

const logoRow = { display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px' };

const closeBtn = { padding: 4 };

const brandText = {
  fontSize: 24,
  fontWeight: 700,
  color: '#fff',
  fontFamily: "'Jacques Francois', serif",
};

const itemStyle = (active) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  borderRadius: 10,
  color: active ? '#fff' : '#AEB4C2',
  background: active ? '#A61C24' : 'transparent',
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 500,
});

// Menu tidak aktif: lencana merah terang. Menu aktif (latar merah): lencana putih berangka merah.
const badgeBase = {
  marginLeft: 'auto',
  minWidth: 22,
  height: 22,
  padding: '0 7px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1,
  boxSizing: 'border-box',
};
const badgeInactive = { ...badgeBase, background: '#FF4D4F', color: '#fff' };
const badgeActive = { ...badgeBase, background: '#fff', color: '#A61C24' };
