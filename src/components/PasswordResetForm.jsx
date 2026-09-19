import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/AuthContext.jsx';

export default function PasswordResetForm({ reset, inputStyle, buttonStyle, linkStyle, onBack }) {
  const { user, loading, finishPasswordRecovery } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saved, setSaved] = useState(false);
  const [requestNew, setRequestNew] = useState(false);
  const editing = reset && !requestNew;
  const invalid = editing && !loading && !user;

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    if (password !== confirmation) {
      setError('Konfirmasi sandi tidak cocok.');
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        if (!user) throw new Error('Tautan tidak valid atau sudah kedaluwarsa. Gunakan form reset sandi.');
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setSaved(true);
        setPassword('');
        setConfirmation('');
        setNotice('Sandi berhasil diperbarui.');
      } else {
        const response = await fetch('/api/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password, confirmation })
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success) throw new Error(result?.error || 'Reset sandi belum tersedia. Coba lagi nanti.');
        setSaved(true);
        setPassword('');
        setConfirmation('');
        setNotice('Sandi berhasil diperbarui. Silakan masuk dengan sandi baru.');
      }
    } catch (err) {
      setError(err.message || 'Permintaan gagal. Silakan coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  const field = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 };
  return <div style={{ color: '#fff', marginTop: 20 }}>
    {editing && loading && <p role="status">Memeriksa tautan…</p>}
    {invalid && <p role="alert">Tautan tidak valid atau sudah kedaluwarsa. Gunakan form reset sandi.</p>}
    {!editing && <p style={{ fontSize: 13 }}>Masukkan email yang terdaftar dan sandi baru.</p>}
    {!saved && !invalid && !(editing && loading) && <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!editing && <label style={field}>Email
        <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
      </label>}
      <>
        <label style={field}>Sandi baru
          <input type="password" autoComplete="new-password" minLength={6} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
        </label>
        <label style={field}>Konfirmasi sandi baru
          <input type="password" autoComplete="new-password" minLength={6} maxLength={128} required value={confirmation} onChange={e => setConfirmation(e.target.value)} style={inputStyle} />
        </label>
      </>
      <button type="submit" disabled={busy} style={buttonStyle}>{busy ? 'Memproses…' : 'Simpan Sandi Baru'}</button>
    </form>}
    {error && <p role="alert" style={{ fontSize: 13 }}>{error}</p>}
    {notice && <p role="status" style={{ fontSize: 13 }}>{notice}</p>}
    {saved ? <button style={buttonStyle} onClick={() => { finishPasswordRecovery(); if (editing) navigate('/redirect', { replace: true }); else onBack(); }}>{editing ? 'Lanjutkan' : 'Kembali ke masuk'}</button> :
      <button disabled={busy} style={{ ...linkStyle, marginTop: 20 }} onClick={() => {
        setError(null); setNotice(null);
        if (editing) { setRequestNew(true); setPassword(''); setConfirmation(''); }
        else { finishPasswordRecovery(); onBack(); }
      }}>{editing ? 'Reset dengan email terdaftar' : 'Kembali ke masuk'}</button>}
  </div>;
}
