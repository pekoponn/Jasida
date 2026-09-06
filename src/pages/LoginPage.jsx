import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import workerIllustration from '../assets/worker-illustration.png';
import brandLogo from '../assets/brand-logo.png';

export default function LoginPage() {
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (user) {
    navigate('/');
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'register') {
        await signUp({ email, password, username });
      } else {
        await signIn({ email, password });
      }
      navigate('/');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={wrapper}>
      <style>{responsiveCss}</style>

      {/* Latar Belakang Merah Melengkung di Kanan */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={redBackgroundStyle}
        className="red-bg-svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="redGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#A61C24" />
            <stop offset="100%" stopColor="#7C1420" />
          </linearGradient>
        </defs>
        {/* Path ini dibalik: putihnya yang menjorok (melengkung) ke dalam merah */}
        <path
          d="M 100 0 L 40 0 C 40 0, 70 70, 35 125 L 200 100 Z"
          fill="url(#redGradient)"
        />
      </svg>

      {/* Tombol Kembali (Pojok Kanan Atas) */}
      <button 
        type="button" 
        onClick={() => navigate(-1)} 
        style={backBtn}
      >
        Kembali <span aria-hidden="true">→</span>
      </button>

      {/* Header Logo (Posisi Absolut di Kiri Atas) */}
      <div style={brandHeader}>
        <img src={brandLogo} alt="Logo" style={logoImg} />
      </div>

      {/* Panel Kiri: Ilustrasi */}
      <div style={leftPanel} className="auth-brand-panel">
        <div style={illustrationWrap}>
          <img src={workerIllustration} alt="Ilustrasi Pekerja" style={illustrationImg} />
        </div>
      </div>

      {/* Panel Kanan: Form */}
      <div style={rightPanel} className="auth-form-panel">
        <div style={formContainer}>
          <h1 className="display" style={{ fontSize: 32, marginBottom: 12, color: '#ffffff', userSelect: 'none', cursor: 'default' }}>
            {mode === 'login' ? 'Masuk' : 'Daftar'}
          </h1>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
            {mode === 'register' && (
              <Field label="Username">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  style={inputStyle}
                />
              </Field>
            )}

            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
            </Field>

            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={inputStyle}
              />
            </Field>

            {mode === 'login' && (
              <button
                type="button"
                onClick={() => alert('Fitur reset password belum tersedia.')}
                style={forgotLink}
              >
                Lupa Sandi?
              </button>
            )}

            {error && <p style={{ color: '#ffb3b3', fontSize: 13, margin: 0 }}>{error}</p>}

            <button type="submit" disabled={loading} style={submitBtn}>
              {loading ? 'Memproses…' : mode === 'login' ? 'Masuk Sekarang' : 'Daftar Sekarang'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 13, marginTop: 28, color: 'rgba(255, 255, 255, 0.8)' }}>
            {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
              style={linkBtn}
            >
              {mode === 'login' ? 'Daftar di sini' : 'Masuk di sini'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 500, color: '#ffffff', userSelect: 'none', cursor: 'default' }}>
      {label}
      {children}
    </label>
  );
}

// ==========================================
// STYLES
// ==========================================

const responsiveCss = `
  @media (max-width: 860px) {
    .auth-brand-panel, .brand-header { display: none !important; }
    .red-bg-svg { 
      width: 100% !important; 
    }
  }
`;

const wrapper = {
  display: 'flex',
  minHeight: '100vh',
  width: '100%',
  position: 'relative',
  backgroundColor: '#f8f9fa', 
  overflow: 'hidden'
};

const redBackgroundStyle = {
  position: 'absolute',
  right: 0,
  top: 0,
  height: '100%',
  width: '100%', // Diubah 100% agar kordinat SVG pas dengan layar
  zIndex: 0
};

const backBtn = {
  position: 'absolute',
  top: '40px',
  right: '60px',
  padding: '10px 24px',
  borderRadius: '999px',
  backgroundColor: '#ffffff',
  color: '#A61C24',
  border: 'none',
  fontWeight: 'bold',
  fontSize: '14px',
  cursor: 'pointer',
  zIndex: 10,
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  display: 'flex',
  alignItems: 'center',
  gap: '6px'
};

const brandHeader = { 
  position: 'absolute',
  top: '40px',
  left: '60px',
  zIndex: 2,
  className: 'brand-header'
};

const logoImg = { 
  height: 75,
  width: 'auto' 
};

const leftPanel = {
  flex: '1 1 50%',
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  zIndex: 1
};

const illustrationWrap = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px'
};

const illustrationImg = { width: '100%', maxWidth: 450, height: 'auto' };

const rightPanel = {
  flex: '0 0 50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px',
  position: 'relative',
  zIndex: 1
};

const formContainer = { 
  width: '100%', 
  maxWidth: 320, // Diperkecil dari sebelumnya 340
  marginLeft: '10px' // Digeser ke kanan agar tidak menabrak lengkungan
};

const inputStyle = {
  padding: '12px 14px',
  borderRadius: '8px',
  border: '1.5px solid #ffffff',
  background: 'transparent',
  color: '#ffffff',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none'
};

const forgotLink = {
  alignSelf: 'flex-end',
  background: 'none',
  border: 'none',
  color: '#ffffff',
  fontSize: 12,
  cursor: 'pointer',
  padding: 0,
  marginTop: -4,
  textDecoration: 'underline'
};

const submitBtn = {
  padding: '12px 20px',
  borderRadius: 999,
  border: 'none',
  background: '#ffffff',
  color: '#A61C24', 
  fontWeight: 700,
  fontSize: 14,
  marginTop: 8,
  cursor: 'pointer',
  transition: 'opacity 0.2s'
};

const linkBtn = {
  background: 'none',
  border: 'none',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
  padding: 0,
  fontSize: 13,
  textDecoration: 'underline'
};