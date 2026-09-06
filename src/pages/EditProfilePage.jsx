import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { updateProfile, uploadAvatar } from '../lib/profile.js';

export default function EditProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState(profile?.username ?? '');
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  if (!user) {
    navigate('/login');
    return null;
  }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      if (avatarFile) {
        await uploadAvatar(user.id, avatarFile);
      }
      await updateProfile({ userId: user.id, username, fullName });
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
    <section style={{ maxWidth: 360, margin: '40px auto' }}>
      <h1 className="display" style={{ fontSize: 22, marginBottom: 4 }}>Edit Profil</h1>
      <p style={{ color: 'var(--color-ink-soft)', fontSize: 14, marginTop: 0 }}>
        Ubah nama, username, dan foto profil kamu.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={avatarWrapper}>
            {avatarPreview ? (
              <img src={avatarPreview} alt="Foto profil" style={avatarImg} />
            ) : (
              <span style={avatarPlaceholder}>{(username || 'U')[0].toUpperCase()}</span>
            )}
          </div>
          <label style={uploadBtn}>
            Ganti Foto
            <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
          </label>
        </div>

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="Nama lengkap"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          style={inputStyle}
        />

        {error && <p style={{ color: 'var(--sev-emergency)', fontSize: 13, margin: 0 }}>{error}</p>}
        {success && <p style={{ color: '#2f9e44', fontSize: 13, margin: 0 }}>Profil berhasil disimpan.</p>}

        <button type="submit" disabled={saving} style={primaryBtn}>
          {saving ? 'Menyimpan…' : 'Simpan Perubahan'}
        </button>
      </form>
    </section>
  );
}

const avatarWrapper = {
  width: 88, height: 88, borderRadius: '50%', overflow: 'hidden',
  background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center'
};

const avatarImg = { width: '100%', height: '100%', objectFit: 'cover' };

const avatarPlaceholder = { color: 'var(--color-primary-ink)', fontSize: 32, fontWeight: 700 };

const uploadBtn = {
  padding: '8px 16px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
};

const inputStyle = {
  padding: '12px 14px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)', fontSize: 15
};

const primaryBtn = {
  padding: '13px 20px', borderRadius: 'var(--radius-md)', border: 'none',
  background: 'var(--color-primary)', color: 'var(--color-primary-ink)', fontWeight: 700, fontSize: 15
};