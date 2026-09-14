import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Clock, Copy, Map, BarChart3, Users, X } from 'lucide-react';
import jasidaLogo from '../assets/jasida-logo-white.png'; // ⬅️ sesuaikan nama file & path-nya

const MENU = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/laporan', label: 'Kelola Laporan', icon: ClipboardList },
  { to: '/admin/darurat', label: 'Laporan Darurat', icon: Clock },
  { to: '/admin/duplikasi', label: 'Deteksi Duplikasi', icon: Copy },
  { to: '/admin/peta', label: 'Peta Laporan', icon: Map },
  { to: '/admin/statistik', label: 'Statistik', icon: BarChart3 },
  { to: '/admin/pengguna', label: 'Pengguna', icon: Users },
];

export default function AdminSidebar({ mobileOpen = false, onClose }) {
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [mobileOpen]);

  return (
    <>
      <style>{sidebarCss}</style>

      {mobileOpen && <div className="admin-sidebar-backdrop" onClick={onClose} />}

      <aside className={`admin-sidebar${mobileOpen ? ' admin-sidebar-open' : ''}`} style={sidebar}>
        <div style={logoRow}>
          <img src={jasidaLogo} alt="Jasida" style={{ height: 36 }} />
          <span style={brandText}>Jasida</span>
          <button onClick={onClose} className="admin-sidebar-close" style={closeBtn} aria-label="Tutup menu">
            <X size={20} color="#fff" />
          </button>
        </div>

        <nav style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {MENU.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={onClose} style={({ isActive }) => itemStyle(isActive)}>
              <Icon size={18} />
              <span>{label}</span>
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

  @media (max-width: 900px) {
    .admin-sidebar {
      position: fixed !important;
      top: 0;
      left: 0;
      height: 100vh;
      z-index: 60;
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
      z-index: 50;
    }
  }
`;

const sidebar = {
  width: 260,
  minHeight: '100vh',
  background: '#141B2E',
  padding: '28px 16px',
  flexShrink: 0,
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