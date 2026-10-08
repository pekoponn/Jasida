import PasswordResetForm from '../components/PasswordResetForm.jsx';
import { useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../lib/AuthContext.jsx';
import workerIllustration from '../assets/worker-illustration.png';
import brandLogo from '../assets/brand-logo.png';
import Navbar from '../components/Navbar.jsx';
import { useIsMobileDevice } from '../lib/useIsMobileDevice.js';

export default function LoginPage() {
  const { signIn, signInWithGoogle, user, passwordRecovery } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const resetRequested = new URLSearchParams(location.search).get('mode') === 'reset';
  const isMobileDevice = useIsMobileDevice();
  const [mode, setMode] = useState('login'); // 'login' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const recoveryMode = passwordRecovery || resetRequested;
  const showRecovery = recoveryMode || mode === 'forgot';

  if (user && !showRecovery) {
    return <Navigate to="/redirect" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn({ email, password });
      navigate('/redirect');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle(); // browser pindah ke halaman Google
    } catch (err) {
      console.error(err);
      setError(err.message || 'Gagal masuk dengan Google.');
      setGoogleLoading(false);
    }
  }

  const title = showRecovery ? (recoveryMode ? 'Atur Sandi Baru' : 'Lupa Sandi') : 'Masuk';

  return (
    <>
      {isMobileDevice && <Navbar />}
      <div style={wrapper}>
        <style>{responsiveCss}</style>
        <style>{animationCss}</style>

        {/* Latar Belakang Merah Melengkung di Kanan */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={redBackgroundStyle}
          className="red-bg-svg lg-red-bg"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="redGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#A61C24" />
              <stop offset="100%" stopColor="#7C1420" />
            </linearGradient>
          </defs>
          {/* Path ini dibalik: putihnya yang menjorok (melengkung) ke dalam merah */}
          <path d="M 100 0 L 40 0 C 40 0, 70 70, 35 125 L 200 100 Z" fill="url(#redGradient)" />
        </svg>

        {/* Tombol Kembali (Pojok Kanan Atas) */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={backBtn}
          className="mobile-back-btn lg-back"
        >
          Kembali{' '}
          <span className="lg-back-arrow" aria-hidden="true">
            →
          </span>
        </button>

        {/* Header Logo (Posisi Absolut di Kiri Atas) */}
        <div style={brandHeader} className="brand-header lg-brand">
          <img src={brandLogo} alt="Logo" style={logoImg} />
        </div>

        {/* Panel Kiri: Ilustrasi */}
        <div style={leftPanel} className="auth-brand-panel">
          <div style={illustrationWrap}>
            <img
              src={workerIllustration}
              alt="Ilustrasi Pekerja"
              className="lg-illustration"
              style={illustrationImg}
            />
          </div>
        </div>

        {/* Panel Kanan: Form */}
        <div style={rightPanel} className="auth-form-panel">
          <div style={formContainer} className="auth-form-container lg-container">
            <img
              src={workerIllustration}
              alt="Ilustrasi Pekerja"
              className="mobile-illustration lg-mobile-illustration"
              style={mobileIllustrationImg}
            />
            <h1
              key={title}
              className="display lg-title"
              style={{
                fontSize: 32,
                marginBottom: 12,
                color: '#ffffff',
                userSelect: 'none',
                cursor: 'default',
              }}
            >
              {title}
            </h1>

            {showRecovery ? (
              <div key="recovery" className="lg-swap">
                <PasswordResetForm
                  reset={recoveryMode}
                  inputStyle={inputStyle}
                  buttonStyle={submitBtn}
                  linkStyle={linkBtn}
                  onBack={() => {
                    setMode('login');
                    navigate('/login', { replace: true });
                  }}
                />
              </div>
            ) : (
              <div key={mode} className="lg-swap">

                <form
                  onSubmit={handleSubmit}
                  className="lg-stagger"
                  style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                >
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
                    <span style={passwordFieldStyle}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        style={{
                          ...inputStyle,
                          width: '100%',
                          paddingRight: 50,
                          boxSizing: 'border-box',
                        }}
                      />
                      <button
                        type="button"
                        className="lg-eye"
                        onClick={() => setShowPassword((visible) => !visible)}
                        aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                        aria-pressed={showPassword}
                        style={passwordVisibilityButton}
                      >
                        <span key={showPassword ? 'hide' : 'show'} className="lg-eye-icon">
                          {showPassword ? (
                            <EyeOff size={19} aria-hidden="true" />
                          ) : (
                            <Eye size={19} aria-hidden="true" />
                          )}
                        </span>
                      </button>
                    </span>
                  </Field>

                  <button
                    type="button"
                    className="lg-link lg-forgot"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                    }}
                    style={forgotLink}
                  >
                    Lupa Sandi?
                  </button>

                  {error && (
                    <p
                      key={error}
                      role="alert"
                      className="lg-error"
                      style={{ color: '#ffb3b3', fontSize: 13, margin: 0 }}
                    >
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || googleLoading}
                    className="lg-submit"
                    style={submitBtn}
                  >
                    {loading && <span className="lg-spinner" aria-hidden="true" />}
                    {loading ? 'Memproses…' : 'Masuk Sekarang'}
                  </button>
                </form>

                <div className="lg-divider" aria-hidden="true">
                  <span>atau</span>
                </div>

                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={googleLoading || loading}
                  className="lg-google"
                  style={googleBtn}
                >
                  {googleLoading ? (
                    <span className="lg-spinner" aria-hidden="true" />
                  ) : (
                    <GoogleLogo />
                  )}
                  {googleLoading ? 'Mengarahkan…' : 'Masuk / Daftar dengan Google'}
                </button>

                <p className="lg-hint" style={hintText}>
                  Pendaftaran akun baru hanya lewat Google.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }) {
  return (
    <label
      className="lg-field"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontSize: 13,
        fontWeight: 500,
        color: '#ffffff',
        userSelect: 'none',
        cursor: 'default',
      }}
    >
      {label}
      {children}
    </label>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

const animationCss = `
  @keyframes lg-fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes lg-fade-down {
    from { opacity: 0; transform: translateY(-14px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes lg-slide-left-in {
    from { opacity: 0; transform: translateX(-40px) scale(0.96); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes lg-red-in {
    from { opacity: 0; transform: translateX(35%); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes lg-float {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-10px); }
  }
  @keyframes lg-pop {
    0%   { opacity: 0; transform: scale(0.6); }
    60%  { opacity: 1; transform: scale(1.1); }
    100% { opacity: 1; transform: scale(1); }
  }
  @keyframes lg-shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-6px); }
    40% { transform: translateX(6px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }
  @keyframes lg-spin { to { transform: rotate(360deg); } }
  @keyframes lg-eye-in {
    from { opacity: 0; transform: scale(0.5) rotate(-25deg); }
    to   { opacity: 1; transform: none; }
  }

  /* ---------- Satu rangkaian animasi saat halaman dibuka ---------- */
  .lg-red-bg { animation: lg-red-in 0.9s cubic-bezier(.22,1,.36,1) backwards; }
  .lg-brand { animation: lg-fade-down 0.6s cubic-bezier(.22,1,.36,1) 0.15s backwards; }
  .lg-back { animation: lg-fade-down 0.6s cubic-bezier(.22,1,.36,1) 0.25s backwards; }
  .lg-illustration {
    animation:
      lg-slide-left-in 0.9s cubic-bezier(.22,1,.36,1) 0.2s backwards,
      lg-float 6s ease-in-out 1.2s infinite;
  }
  .lg-mobile-illustration { animation: lg-pop 0.6s cubic-bezier(.34,1.56,.64,1) 0.1s backwards, lg-float 6s ease-in-out 1s infinite; }
  .lg-container { animation: lg-fade-up 0.7s cubic-bezier(.22,1,.36,1) 0.3s backwards; }

  /* ---------- Ganti mode (Masuk / Lupa Sandi) ---------- */
  .lg-title { animation: lg-fade-up 0.4s cubic-bezier(.22,1,.36,1) backwards; }
  .lg-swap { animation: lg-fade-up 0.4s cubic-bezier(.22,1,.36,1) backwards; }
  .lg-stagger > * { animation: lg-fade-up 0.5s cubic-bezier(.22,1,.36,1) backwards; }
  .lg-stagger > *:nth-child(1) { animation-delay: 0.05s; }
  .lg-stagger > *:nth-child(2) { animation-delay: 0.11s; }
  .lg-stagger > *:nth-child(3) { animation-delay: 0.17s; }
  .lg-stagger > *:nth-child(4) { animation-delay: 0.23s; }

  /* ---------- Input ---------- */
  .auth-form-container input {
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
  }
  .auth-form-container input:hover { background-color: rgba(255,255,255,0.05) !important; }
  .auth-form-container input:focus {
    background-color: rgba(255,255,255,0.1) !important;
    box-shadow: 0 0 0 4px rgba(255,255,255,0.2);
  }
  .lg-field { transition: opacity 0.2s ease; }

  /* ---------- Tombol kirim (juga dipakai form reset sandi) ---------- */
  .auth-form-container button[type="submit"] {
    transition: transform 0.2s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s ease, opacity 0.2s ease;
  }
  .auth-form-container button[type="submit"]:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.25);
  }
  .auth-form-container button[type="submit"]:active:not(:disabled) {
    transform: scale(0.96);
    box-shadow: none;
  }
  .auth-form-container button[type="submit"]:disabled { opacity: 0.75; cursor: not-allowed !important; }
  .auth-form-container button[type="submit"]:focus-visible,
  .lg-link:focus-visible, .lg-eye:focus-visible, .lg-back:focus-visible {
    outline: 2px solid #fff; outline-offset: 3px;
  }
  .lg-submit { display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
  .lg-spinner {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2.5px solid rgba(166,28,36,0.25); border-top-color: #A61C24;
    animation: lg-spin 0.7s linear infinite;
  }

  /* ---------- Tombol Google + pemisah ---------- */
  .lg-divider {
    display: flex; align-items: center; gap: 12px;
    margin: 20px 0 16px; color: rgba(255,255,255,0.75); font-size: 12px;
    animation: lg-fade-up 0.5s cubic-bezier(.22,1,.36,1) 0.2s backwards;
  }
  .lg-divider::before, .lg-divider::after {
    content: ""; flex: 1; height: 1px; background: rgba(255,255,255,0.35);
  }
  .lg-google {
    animation: lg-fade-up 0.5s cubic-bezier(.22,1,.36,1) 0.1s backwards;
    transition: transform 0.2s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s ease, opacity 0.2s ease;
  }
  .lg-google:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.25); }
  .lg-google:active:not(:disabled) { transform: scale(0.97); box-shadow: none; }
  .lg-google:disabled { opacity: 0.75; cursor: not-allowed !important; }
  .lg-google:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }

  /* ---------- Tautan teks ---------- */
  .lg-link { transition: opacity 0.2s ease, transform 0.2s ease; }
  .lg-link:hover { opacity: 0.8; transform: translateY(-1px); }
  .lg-link:active { transform: scale(0.96); }

  /* ---------- Tombol mata (password) ---------- */
  .lg-eye { transition: transform 0.2s cubic-bezier(.34,1.56,.64,1), background-color 0.2s ease; }
  .lg-eye:hover { transform: translateY(-50%) scale(1.1) !important; background: #fff !important; }
  .lg-eye:active { transform: translateY(-50%) scale(0.92) !important; }
  .lg-eye-icon { display: grid; place-items: center; animation: lg-eye-in 0.25s cubic-bezier(.34,1.56,.64,1); }

  /* ---------- Tombol kembali ---------- */
  .lg-back { transition: transform 0.2s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s ease; }
  .lg-back:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.18) !important; }
  .lg-back:active { transform: scale(0.95); }
  .lg-back-arrow { display: inline-block; transition: transform 0.2s ease; }
  .lg-back:hover .lg-back-arrow { transform: translateX(4px); }

  /* ---------- Pesan ---------- */
  .lg-error { animation: lg-shake 0.45s ease; }

  /* ---------- Hormati preferensi pengguna ---------- */
  @media (prefers-reduced-motion: reduce) {
    .lg-red-bg, .lg-brand, .lg-back, .lg-illustration, .lg-mobile-illustration, .lg-container,
    .lg-title, .lg-swap, .lg-stagger > *, .lg-error, .lg-eye-icon,
    .lg-divider, .lg-google {
      animation: none !important;
    }
    .auth-form-container input, .auth-form-container button[type="submit"], .lg-link,
    .lg-eye, .lg-back, .lg-back-arrow, .lg-google { transition: none !important; }
    .lg-spinner { animation-duration: 2s; }
  }
`;

const responsiveCss = `
  @media (max-width: 860px) {
    .auth-brand-panel { display: none !important; }

    .red-bg-svg { display: none !important; }

    .brand-header {
      display: none !important;
    }

    .auth-form-panel {
      flex: 1 1 100% !important;
      width: 100% !important;
      min-height: 100vh !important;
      background: linear-gradient(180deg, #A61C24 0%, #7C1420 100%) !important;
      padding: 90px 24px 90px !important;
      box-sizing: border-box !important;
      align-items: flex-start !important;
      position: relative !important;
      overflow: hidden !important;
    }

    .auth-form-panel::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 230px;
      background: #ffffff;
      border-bottom-left-radius: 50% 60px;
      border-bottom-right-radius: 50% 60px;
      z-index: 0;
    }

    .auth-form-container {
      max-width: 100% !important;
      margin-left: 0 !important;
      text-align: left !important;
      position: relative !important;
      z-index: 1 !important;
    }

    .mobile-illustration-wrap {
      position: relative;
      display: flex;
      justify-content: center;
      margin: 0 auto 16px;
    }

    .mobile-illustration {
      display: block !important;
      position: relative;
      z-index: 1;
    }

    .mobile-back-btn {
      position: fixed !important;
      top: 16px !important;
      right: 16px !important;
      padding: 8px 18px !important;
      font-size: 12px !important;
      background: #A61C24 !important;
      color: #ffffff !important;
      z-index: 1000 !important;
    }
  }
`;

const wrapper = {
  display: 'flex',
  minHeight: '100vh',
  width: '100%',
  position: 'relative',
  backgroundColor: '#f8f9fa',
  overflow: 'hidden',
};

const redBackgroundStyle = {
  position: 'absolute',
  right: 0,
  top: 0,
  height: '100%',
  width: '100%', // Diubah 100% agar kordinat SVG pas dengan layar
  zIndex: 0,
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
  gap: '6px',
};

const brandHeader = {
  position: 'absolute',
  top: '40px',
  left: '60px',
  zIndex: 2,
};

const logoImg = {
  height: 75,
  width: 'auto',
};

const leftPanel = {
  flex: '1 1 50%',
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  zIndex: 1,
};

const illustrationWrap = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px',
};

const illustrationImg = { width: '100%', maxWidth: 450, height: 'auto' };

const mobileIllustrationImg = {
  display: 'none',
  width: '55%',
  maxWidth: 180,
  height: 'auto',
  margin: '0 auto 16px',
};

const rightPanel = {
  flex: '0 0 50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px',
  position: 'relative',
  zIndex: 1,
};

const formContainer = {
  width: '100%',
  maxWidth: 320, // Diperkecil dari sebelumnya 340
  marginLeft: '10px', // Digeser ke kanan agar tidak menabrak lengkungan
};

const inputStyle = {
  padding: '12px 14px',
  borderRadius: '8px',
  border: '1.5px solid #ffffff',
  background: 'transparent',
  color: '#ffffff',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
};

const passwordFieldStyle = {
  position: 'relative',
  display: 'block',
  width: '100%',
};

const passwordVisibilityButton = {
  position: 'absolute',
  top: '50%',
  right: 8,
  transform: 'translateY(-50%)',
  display: 'grid',
  placeItems: 'center',
  width: 34,
  height: 34,
  padding: 0,
  border: 'none',
  borderRadius: 7,
  background: 'rgba(255, 255, 255, 0.94)',
  color: '#A61C24',
  cursor: 'pointer',
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
  textDecoration: 'underline',
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
};

const googleBtn = {
  width: '100%',
  padding: '12px 20px',
  borderRadius: 999,
  border: '1px solid #dadce0',
  background: '#ffffff',
  color: '#3c4043',
  fontWeight: 600,
  fontSize: 14,
  fontFamily: 'inherit',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
};

const hintText = {
  textAlign: 'center',
  fontSize: 12,
  margin: '10px 0 0',
  color: 'rgba(255, 255, 255, 0.8)',
};

const linkBtn = {
  background: 'none',
  border: 'none',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
  padding: 0,
  fontSize: 13,
  textDecoration: 'underline',
};