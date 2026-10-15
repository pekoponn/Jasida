import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Menu, User } from 'lucide-react';
import { useAuth } from '../lib/AuthContext.jsx';
import { useNotifications } from '../lib/useNotifications.js';
import NotificationPanel from './NotificationPanel.jsx';

export default function AdminTopbar({ onMenuClick }) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { items, unread, read, readAll } = useNotifications(user?.id);
  const wrapperRef = useRef(null);

  const name = profile?.username || profile?.full_name || 'Admin';
  const roleLabel = profile?.role === 'admin' ? 'Administrasi' : (profile?.role ?? '');

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleNotifItem(n) {
    setNotifOpen(false);
    if (!n.read_at) read(n.id);
    if (n.link) navigate(n.link);
  }

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    navigate('/login');
  }

  return (
    <header className="admin-topbar" style={topbar}>
      <style>{topbarCss}</style>

      <button
        className="admin-topbar-hamburger"
        style={hamburgerBtn}
        onClick={onMenuClick}
        aria-label="Buka menu"
      >
        <Menu size={22} color="#1a1a1a" />
      </button>

      <div style={{ flex: 1 }} />

      <div ref={wrapperRef} style={{ position: 'relative' }}>
        <button
          style={profileBtn}
          onClick={() => {
            setNotifOpen(false);
            setOpen((v) => !v);
          }}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {unread > 0 && <span style={avatarDot} />}
            <div style={avatar}>
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={name}
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <User size={18} color="#868e96" />
              )}
            </div>
          </div>

          {/* Disembunyikan lewat CSS di layar sempit, bukan di-unmount, supaya tidak perlu JS resize listener */}
          <div className="admin-topbar-name" style={{ textAlign: 'left' }}>
            <div style={nameText}>{name}</div>
            {roleLabel && <div style={roleText}>{roleLabel}</div>}
          </div>

          <ChevronDown
            size={16}
            color="#868e96"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
          />
        </button>

        {open && (
          <div style={dropdown}>
            {/* Muncul cuma di layar sempit — nama/role yang hilang dari tombol utama ditaruh di sini */}
            <div className="admin-topbar-dropdown-header" style={dropdownHeader}>
              <div style={nameText}>{name}</div>
              {roleLabel && <div style={roleText}>{roleLabel}</div>}
            </div>
            <button
              style={dropdownItem}
              onClick={() => {
                setOpen(false);
                navigate('/admin/profil');
              }}
            >
              <User size={16} /> Profil Saya
            </button>
            <button
              style={dropdownItem}
              onClick={() => {
                setOpen(false);
                setNotifOpen(true);
              }}
            >
              <Bell size={16} /> Notifikasi
              {unread > 0 && <span style={countBadge}>{unread > 99 ? '99+' : unread}</span>}
            </button>
            <button style={{ ...dropdownItem, color: '#e03131' }} onClick={handleSignOut}>
              <LogOut size={16} /> Keluar
            </button>
          </div>
        )}

        {notifOpen && (
          <NotificationPanel
            items={items}
            unread={unread}
            onItemClick={handleNotifItem}
            onReadAll={readAll}
            style={{ position: 'absolute', top: '110%', right: 0, zIndex: 20 }}
          />
        )}
      </div>
    </header>
  );
}

const topbarCss = `
  .admin-topbar-hamburger { display: none; }
  .admin-topbar-dropdown-header { display: none; }

  @media (max-width: 900px) {
    .admin-topbar { padding: 0 16px !important; }
    .admin-topbar-hamburger { display: flex !important; }
    .admin-topbar-name { display: none !important; }
    .admin-topbar-dropdown-header { display: block !important; }
  }
`;

const topbar = {
  height: 64,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  padding: '0 32px',
  background: '#fff',
  borderBottom: '1px solid #EDEEF2',
  position: 'sticky',
  top: 0,
  zIndex: 2100,
};

const hamburgerBtn = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: 6,
  marginRight: 4,
};

const profileBtn = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '6px 10px',
  borderRadius: 999,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
};

const avatar = {
  width: 34,
  height: 34,
  borderRadius: '50%',
  background: '#F1F3F5',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  overflow: 'hidden',
};

const nameText = { fontSize: 14, fontWeight: 700, color: '#1a1a1a', textTransform: 'capitalize' };
const roleText = { fontSize: 12, color: '#868e96' };

const dropdown = {
  position: 'absolute',
  top: '110%',
  right: 0,
  minWidth: 190,
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
  padding: 6,
  zIndex: 20,
};

const dropdownHeader = {
  padding: '10px 12px',
  borderBottom: '1px solid #EDEEF2',
  marginBottom: 6,
};

const dropdownItem = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '10px 12px',
  border: 'none',
  background: 'transparent',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  color: '#1a1a1a',
  cursor: 'pointer',
  textAlign: 'left',
};

const avatarDot = {
  position: 'absolute',
  top: -1,
  right: -1,
  width: 11,
  height: 11,
  borderRadius: '50%',
  background: '#A61C24',
  border: '2px solid #fff',
  zIndex: 1,
};

const countBadge = {
  marginLeft: 'auto',
  minWidth: 20,
  padding: '1px 7px',
  borderRadius: 999,
  background: '#A61C24',
  color: '#fff',
  fontSize: 11,
  fontWeight: 700,
  textAlign: 'center',
};