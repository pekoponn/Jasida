import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import RoleRedirect from '../components/RoleRedirect.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { updateProfile, updateAvatarUrl } from '../lib/profile.js';
import { useIsMobileDevice } from '../lib/useIsMobileDevice.js';

import avatar1 from '../assets/avatars/avatar-1.png';
import avatar2 from '../assets/avatars/avatar-2.png';
import avatar3 from '../assets/avatars/avatar-3.png';
import avatar4 from '../assets/avatars/avatar-4.png';
import avatar5 from '../assets/avatars/avatar-5.png';
import avatar6 from '../assets/avatars/avatar-6.png';
import avatar7 from '../assets/avatars/avatar-7.png';
import avatar8 from '../assets/avatars/avatar-8.png';
import avatar9 from '../assets/avatars/avatar-9.png';

const AVATAR_PRESETS = [
  avatar1, avatar2, avatar3,
  avatar4, avatar5, avatar6,
  avatar7, avatar8, avatar9
];

export default function EditProfilePage() {
  const { user, profile, loading } = useAuth();
  if (loading) return <p role="status">Memuat profil…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <RoleRedirect />;
  return <ProfileForm key={user.id} />;
}

function ProfileForm() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const isMobileDevice = useIsMobileDevice();

  const [username, setUsername] = useState(profile?.username ?? '');
  const [selectedAvatar, setSelectedAvatar] = useState(profile?.avatar_url ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      if (selectedAvatar !== profile?.avatar_url) {
        await updateAvatarUrl(user.id, selectedAvatar);
      }
      await updateProfile({ userId: user.id, username, fullName: profile?.full_name ?? null });
      await refreshProfile();
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Gagal menyimpan profil.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={{ maxWidth: 380, margin: '48px auto' }}>
      <h1 className="display" style={{ fontSize: 22, marginBottom: 4 }}>Edit Profil</h1>
      <p style={{ color: 'var(--color-ink-soft)', fontSize: 14, marginTop: 0, marginBottom: 32 }}>
        Ubah username dan avatar kamu.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <div style={avatarOuterWrap}>
            <div style={avatarWrapper}>
              {selectedAvatar ? (
                <img src={selectedAvatar} alt="Foto profil" style={avatarImg} />
              ) : (
                <DefaultAvatarIcon />
              )}
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              style={editBadgeBtn}
              aria-label="Ganti avatar"
            >
              <PencilIcon />
            </button>
          </div>
        </div>

        {pickerOpen && (
          <div style={avatarGrid}>
            {AVATAR_PRESETS.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => { setSelectedAvatar(url); setPickerOpen(false); }}
                style={{
                  ...avatarOption,
                  borderColor: selectedAvatar === url ? '#A61C24' : 'transparent'
                }}
              >
                <img src={url} alt="Pilihan avatar" style={avatarOptionImg} />
              </button>
            ))}
          </div>
        )}

        <input
          type="text"
          placeholder="Username"
          aria-label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={inputStyle}
        />

        <input
          type="email"
          aria-label="Email"
          value={user.email ?? ''}
          disabled
          style={inputDisabledStyle}
        />

        {error && <p style={{ color: 'var(--sev-emergency)', fontSize: 13, margin: 0 }}>{error}</p>}
        {success && <p style={{ color: '#2f9e44', fontSize: 13, margin: 0 }}>Profil berhasil disimpan.</p>}

        <button type="submit" disabled={saving} style={primaryBtn}>
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </form>

      {isMobileDevice && (
        <div style={mobileAccountActions}>
          <button type="button" onClick={() => navigate('/riwayat')} style={secondaryBtn}>
            <HistoryIcon /> Riwayat Laporan
          </button>
          <button type="button" onClick={handleSignOut} style={logoutBtn}>
            <LogoutIcon /> Keluar
          </button>
        </div>
      )}
    </section>
  );
}

function HistoryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" />
      <polyline points="3 3 3 9 9 9" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="12 8 12 12 15 14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="16 17 21 12 16 7" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" />
    </svg>
  );
}

function DefaultAvatarIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="#ffffff">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6v1H4v-1z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#495057" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

const avatarOuterWrap = { position: 'relative', width: 140, height: 140 };

const avatarWrapper = {
  width: 140, height: 140, borderRadius: '50%', overflow: 'hidden',
  background: '#9aa0a6', display: 'flex', alignItems: 'center', justifyContent: 'center'
};

const avatarImg = { width: '100%', height: '100%', objectFit: 'cover' };

const editBadgeBtn = {
  position: 'absolute',
  bottom: 4,
  right: 4,
  width: 38,
  height: 38,
  borderRadius: '50%',
  background: '#ffffff',
  border: 'none',
  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer'
};

const avatarGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 14,
  maxWidth: 260,
  margin: '0 auto',
  justifyItems: 'center'
};

const avatarOption = {
  width: 56,
  height: 56,
  borderRadius: '50%',
  padding: 0,
  border: '2px solid transparent',
  cursor: 'pointer',
  overflow: 'hidden',
  background: '#f1f3f5'
};

const avatarOptionImg = { width: '100%', height: '100%', objectFit: 'cover' };

const inputStyle = {
  padding: '15px 18px',
  borderRadius: 10,
  border: '1px solid #dee2e6',
  fontSize: 15,
  fontFamily: 'inherit',
  background: '#fff'
};

const inputDisabledStyle = {
  ...inputStyle,
  background: '#f1f3f5',
  color: '#868e96',
  cursor: 'not-allowed'
};

const primaryBtn = {
  padding: '15px 20px',
  borderRadius: 10,
  border: 'none',
  background: '#A61C24',
  color: '#ffffff',
  fontWeight: 800,
  fontSize: 15,
  cursor: 'pointer',
  marginTop: 8
};

const mobileAccountActions = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  marginTop: 24
};

const secondaryBtn = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '14px 20px',
  borderRadius: 10,
  border: '1.5px solid #A61C24',
  background: '#fff',
  color: '#A61C24',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer'
};

const logoutBtn = {
  ...secondaryBtn,
  border: '1.5px solid #dee2e6',
  color: '#868e96'
};
