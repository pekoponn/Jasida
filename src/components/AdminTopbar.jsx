import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, User } from 'lucide-react';
import { useAuth } from '../lib/AuthContext.jsx';

export default function AdminTopbar({ onMenuClick }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const name = profile?.username || profile?.full_name || 'Admin';
  const roleLabel = profile?.role === 'admin' ? 'Administrasi' : (profile?.role ?? '');

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    navigate('/login');
  }

  return (
    <header className="admin-topbar" style={topbar}>
      <style>{topbarCss}</style>

      <button className="admin-topbar-hamburger" style={hamburgerBtn} onClick={onMenuClick} aria-label="Buka menu">
        <Menu size={22} color="#1a1a1a" />
      </button>

      <div style={{ flex: 1 }} />

      <div ref={wrapperRef} style={{ position: 'relative' }}>
        <button style={profileBtn} onClick={() => setOpen((v) => !v)}>
          <div style={avatar}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <User size={18} color="#868e96" />
            )}
          </div>

          {/* Disembunyikan lewat CSS di layar sempit, bukan di-unmount, supaya tidak perlu JS resize listener */}
          <div className="admin-topbar-name" style={{ textAlign: 'left' }}>
            <div style={nameText}>{name}</div>
            {roleLabel && <div style={roleText}>{roleLabel}</div>}
          </div>

          <ChevronDown size={16} color="#868e96" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>

        {open && (
          <div style={dropdown}>
            {/* Muncul cuma di layar sempit — nama/role yang hilang dari tombol utama ditaruh di sini */}
            <div className="admin-topbar-dropdown-header" style={dropdownHeader}>
              <div style={nameText}>{name}</div>
              {roleLabel && <div style={roleText}>{roleLabel}</div>}
            </div>
            <button style={dropdownItem} onClick={() => { setOpen(false); navigate('/profil'); }}>
              <User size={16} /> Profil Saya
            </button>
            <button style={{ ...dropdownItem, color: '#e03131' }} onClick={handleSignOut}>
              <LogOut size={16} /> Keluar
            </button>
          </div>
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