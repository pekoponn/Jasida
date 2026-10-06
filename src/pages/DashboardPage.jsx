import { useEffect, useMemo, useState } from 'react';
import { listReportsFeed, supportReport, getMySupports, getReportPhotos } from '../lib/reports.js';
import SeverityBadge from '../components/SeverityBadge.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { reverseGeocode } from '../lib/geolocation.js';
import CommentSection from '../components/CommentSection.jsx';
import ZoomableImage from '../components/ZoomableImage.jsx';
import { findKecamatan, getKecamatanNames } from '../lib/kecamatanBoundaries.js';
import roadIcon from '../assets/RoadIcon.png';
import { useIsMobileDevice } from '../lib/useIsMobileDevice.js';
import CustomSelect from '../components/CustomSelect.jsx';
import CustomDateRangePicker from '../components/CustomDateRangePicker.jsx';

/* ------------------------------------------------------------------ */
/*  Animasi global (di-inject sekali)                                  */
/* ------------------------------------------------------------------ */
const DASHBOARD_CSS = `
  /* ---------- Tombol umum ---------- */
  .rw-btn-anim {
    transition: transform 0.18s cubic-bezier(.34,1.56,.64,1), box-shadow 0.18s ease, background-color 0.2s ease;
  }
  .rw-btn-anim:hover:not(:disabled) {
    transform: translateY(-2px) scale(1.04);
    box-shadow: 0 4px 10px rgba(0,0,0,0.14);
  }
  .rw-btn-anim:active:not(:disabled) {
    transform: scale(0.94);
    box-shadow: none;
  }
  .rw-btn-anim:focus-visible,
  .rw-page-btn:focus-visible,
  .rw-photo-nav:focus-visible {
    outline: 2px solid #A42C2B;
    outline-offset: 2px;
  }

  /* ---------- Hero ---------- */
  @keyframes rw-hero-in {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes rw-hero-icon-in {
    from { opacity: 0; transform: translateX(-24px) rotate(-4deg); }
    to   { opacity: 1; transform: translateX(0) rotate(0); }
  }
  @keyframes rw-float {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-8px); }
  }
  .rw-hero { animation: rw-hero-in 0.55s cubic-bezier(.22,1,.36,1) both; }
  .rw-hero-icon {
    animation:
      rw-hero-icon-in 0.7s cubic-bezier(.22,1,.36,1) 0.15s both,
      rw-float 5s ease-in-out 1s infinite;
  }
  .rw-hero-text > * { animation: rw-hero-in 0.55s cubic-bezier(.22,1,.36,1) both; }
  .rw-hero-text > *:nth-child(1) { animation-delay: 0.10s; }
  .rw-hero-text > *:nth-child(2) { animation-delay: 0.20s; }
  .rw-hero-text > *:nth-child(3) { animation-delay: 0.30s; }

  .rw-hero-cta {
    transition: transform 0.18s cubic-bezier(.34,1.56,.64,1), box-shadow 0.18s ease, background-color 0.2s ease;
  }
  .rw-hero-cta:hover {
    transform: translateY(-2px) scale(1.05);
    box-shadow: 0 6px 16px rgba(0,0,0,0.22);
    background-color: #fff5f5;
  }
  .rw-hero-cta:active { transform: scale(0.95); box-shadow: none; }
  .rw-hero-cta .rw-cta-arrow { display: inline-block; transition: transform 0.2s ease; margin-left: 4px; }
  .rw-hero-cta:hover .rw-cta-arrow { transform: translateX(4px); }

  /* ---------- Tombol cari ---------- */
  .rw-search-btn svg { transition: transform 0.25s cubic-bezier(.34,1.56,.64,1); }
  .rw-search-btn:hover svg { transform: scale(1.18) rotate(-12deg); }
  .rw-search-btn:active svg { transform: scale(0.9); }

  /* ---------- Kartu laporan ---------- */
  @keyframes rw-card-in {
    from { opacity: 0; transform: translateY(18px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .rw-card {
    animation: rw-card-in 0.45s cubic-bezier(.22,1,.36,1) both;
    transition: transform 0.25s ease, box-shadow 0.25s ease;
  }
  .rw-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 28px rgba(0,0,0,0.12);
  }

  /* ---------- Foto ---------- */
  @keyframes rw-photo-fade {
    from { opacity: 0; transform: scale(1.04); }
    to   { opacity: 1; transform: scale(1); }
  }
  .rw-photo-fade { width: 100%; height: 100%; animation: rw-photo-fade 0.35s ease both; }
  .rw-photo-nav {
    opacity: 0;
    transition: opacity 0.2s ease, background-color 0.2s ease, transform 0.18s cubic-bezier(.34,1.56,.64,1);
  }
  .rw-photo-wrap:hover .rw-photo-nav,
  .rw-photo-nav:focus-visible { opacity: 1; }
  .rw-photo-nav:hover { background-color: rgba(0,0,0,0.65) !important; transform: translateY(-50%) scale(1.12) !important; }
  .rw-photo-nav:active { transform: translateY(-50%) scale(0.92) !important; }
  @media (hover: none) { .rw-photo-nav { opacity: 1; } }

  @keyframes rw-badge-pop {
    from { opacity: 0; transform: translateY(-4px) scale(0.9); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .rw-photo-badge { animation: rw-badge-pop 0.3s ease both; }

  /* ---------- Ikon ---------- */
  .rw-pin { transform-origin: 50% 100%; }
  .rw-card:hover .rw-pin { animation: rw-pin-bounce 0.6s ease 1; }
  @keyframes rw-pin-bounce {
    0%   { transform: translateY(0); }
    35%  { transform: translateY(-3px); }
    60%  { transform: translateY(0); }
    80%  { transform: translateY(-1px); }
    100% { transform: translateY(0); }
  }

  .rw-reporter { transition: background-color 0.2s ease, transform 0.18s ease; }
  .rw-reporter:hover { background-color: #e9ecef !important; transform: translateY(-1px); }
  .rw-reporter:hover svg { animation: rw-wiggle 0.5s ease 1; }
  @keyframes rw-wiggle {
    0%, 100% { transform: rotate(0); }
    25% { transform: rotate(-12deg); }
    75% { transform: rotate(12deg); }
  }

  /* Jempol */
  .rw-thumb { transition: transform 0.2s cubic-bezier(.34,1.56,.64,1), fill 0.2s ease; transform-origin: 30% 80%; }
  .rw-dukung:not(:disabled):hover .rw-thumb { transform: rotate(-14deg) scale(1.15); }
  .rw-dukung:not(:disabled):active .rw-thumb { transform: rotate(-24deg) scale(0.9); }
  @keyframes rw-thumb-pop {
    0%   { transform: scale(1) rotate(0); }
    30%  { transform: scale(1.6) rotate(-20deg); }
    60%  { transform: scale(0.9) rotate(8deg); }
    100% { transform: scale(1) rotate(0); }
  }
  .rw-thumb-pop { animation: rw-thumb-pop 0.55s cubic-bezier(.34,1.56,.64,1) 1; }
  @keyframes rw-count-bump {
    0%   { transform: translateY(0); }
    40%  { transform: translateY(-5px); color: #A42C2B; }
    100% { transform: translateY(0); }
  }
  .rw-count-bump { display: inline-block; animation: rw-count-bump 0.4s ease 1; }
  @keyframes rw-spin { to { transform: rotate(360deg); } }
  .rw-spinner {
    width: 12px; height: 12px; border-radius: 50%;
    border: 2px solid rgba(166,30,77,0.25); border-top-color: #a61e4d;
    animation: rw-spin 0.7s linear infinite;
  }

  /* Ikon komentar (membungkus CommentSection) */
  .rw-comment-wrap { display: inline-flex; align-items: center; }
  .rw-comment-wrap button { transition: transform 0.18s cubic-bezier(.34,1.56,.64,1), background-color 0.2s ease, box-shadow 0.18s ease; }
  .rw-comment-wrap button:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 3px 8px rgba(0,0,0,0.12); }
  .rw-comment-wrap button:active { transform: scale(0.94); box-shadow: none; }
  .rw-comment-wrap button svg { transition: transform 0.25s cubic-bezier(.34,1.56,.64,1); transform-origin: 50% 70%; }
  .rw-comment-wrap button:hover svg { transform: scale(1.15) rotate(-8deg); }
  .rw-comment-icon-bubble { transition: transform 0.25s cubic-bezier(.34,1.56,.64,1); transform-origin: 50% 70%; }

  /* Status */
  @keyframes rw-pulse {
    0%   { box-shadow: 0 0 0 0 rgba(153,106,0,0.5); }
    70%  { box-shadow: 0 0 0 6px rgba(153,106,0,0); }
    100% { box-shadow: 0 0 0 0 rgba(153,106,0,0); }
  }
  .rw-status-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; margin-right: 6px; flex-shrink: 0; }
  .rw-status-dot.pulse { animation: rw-pulse 1.8s ease-out infinite; }

  @keyframes rw-slide-down {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .rw-reject { animation: rw-slide-down 0.3s ease both; }

  /* ---------- Skeleton ---------- */
  @keyframes rw-shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  .rw-skel {
    background: linear-gradient(90deg, #e9ecef 25%, #f4f5f7 37%, #e9ecef 63%);
    background-size: 800px 100%;
    animation: rw-shimmer 1.4s linear infinite;
    border-radius: 6px;
  }

  /* ---------- Paginasi ---------- */
  .rw-page-btn {
    transition: transform 0.18s cubic-bezier(.34,1.56,.64,1), background-color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
  }
  .rw-page-btn:hover:not(:disabled) { background-color: #FDECEE !important; border-color: #A42C2B !important; transform: scale(1.12); }
  .rw-page-btn:active:not(:disabled) { transform: scale(0.9); }
  @keyframes rw-page-num {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .rw-page-num { display: inline-block; animation: rw-page-num 0.25s ease both; }

  /* ---------- Empty / error ---------- */
  .rw-fade-in { animation: rw-slide-down 0.35s ease both; }

  /* ---------- Hormati preferensi pengguna ---------- */
  @media (prefers-reduced-motion: reduce) {
    .rw-hero, .rw-hero-icon, .rw-hero-text > *, .rw-card, .rw-photo-fade, .rw-photo-badge,
    .rw-thumb-pop, .rw-count-bump, .rw-reject, .rw-page-num, .rw-fade-in,
    .rw-status-dot.pulse, .rw-skel, .rw-pin, .rw-reporter svg {
      animation: none !important;
    }
    .rw-btn-anim, .rw-card, .rw-hero-cta, .rw-photo-nav, .rw-page-btn, .rw-thumb {
      transition: none !important;
    }
  }
`;

export default function DashboardPage() {
  useEffect(() => {
    const style = document.createElement('style');
    style.setAttribute('data-rw-dashboard', '');
    style.textContent = DASHBOARD_CSS;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const [reports, setReports] = useState([]);
  const [mySupports, setMySupports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const isMobileDevice = useIsMobileDevice();
  const navigate = useNavigate();

  const [kecamatanFilter, setKecamatanFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({ kecamatan: '', from: '', to: '' });
  const [page, setPage] = useState(0);
  const REPORTS_PER_PAGE = 9;

  const kecamatanOptions = useMemo(() => getKecamatanNames(), []);

  useEffect(() => {
    listReportsFeed()
      .then(async (data) => {
        setReports(data);
        const supported = await getMySupports(data.map((r) => r.id)).catch(() => []);
        setMySupports(supported);
      })
      .catch((err) => {
        console.error(err);
        setError('Gagal memuat laporan.');
      })
      .finally(() => setLoading(false));
  }, [user]);

  function markSupported(reportId) {
    setMySupports((prev) => [...prev, reportId]);
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, support_count: (r.support_count ?? 0) + 1 } : r))
    );
  }

  function handleSearch() {
    setAppliedFilters({ kecamatan: kecamatanFilter, from: dateFrom, to: dateTo });
  }

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (appliedFilters.kecamatan) {
        const nama =
          typeof r.lat === 'number' && typeof r.lng === 'number'
            ? findKecamatan(r.lat, r.lng)
            : null;
        if (nama !== appliedFilters.kecamatan) return false;
      }
      if (appliedFilters.from) {
        if (new Date(r.created_at) < new Date(appliedFilters.from)) return false;
      }
      if (appliedFilters.to) {
        const toEnd = new Date(appliedFilters.to);
        toEnd.setHours(23, 59, 59, 999);
        if (new Date(r.created_at) > toEnd) return false;
      }
      return true;
    });
  }, [reports, appliedFilters]);

  useEffect(() => {
    setPage(0);
  }, [appliedFilters]);

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / REPORTS_PER_PAGE));
  const pagedReports = useMemo(() => {
    const start = page * REPORTS_PER_PAGE;
    return filteredReports.slice(start, start + REPORTS_PER_PAGE);
  }, [filteredReports, page]);

  function goPrevPage() {
    setPage((p) => Math.max(0, p - 1));
  }

  function goNextPage() {
    setPage((p) => Math.min(totalPages - 1, p + 1));
  }

  return (
    <div style={{ backgroundColor: 'var(--color-bg, #f8f9fa)', minHeight: '100vh' }}>
      {/* Hero Banner Red Header */}
      <section
        className="rw-hero"
        style={{
          ...heroCardStyle,
          flexDirection: isMobileDevice ? 'column' : 'row',
          textAlign: isMobileDevice ? 'center' : 'left',
          margin: isMobileDevice ? '20px 5% 0' : heroCardStyle.margin,
          padding: isMobileDevice ? '28px 20px 24px' : heroCardStyle.padding,
          minHeight: isMobileDevice ? 'auto' : heroCardStyle.minHeight,
        }}
      >
        {!isMobileDevice && (
          <img
            src={roadIcon}
            alt="Jalan"
            className="rw-hero-icon"
            style={heroIconStyle}
            onError={(e) => (e.target.style.display = 'none')}
          />
        )}
        <div
          className="rw-hero-text"
          style={{
            color: '#ffffff',
            marginLeft: isMobileDevice ? 0 : 350,
            marginTop: isMobileDevice ? 10 : 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 30, fontWeight: 450 }}>
            Bersama Jaga Sidoarjo. Laporkan Sekarang!
          </h2>
          <p style={{ margin: '10px 0 18px', fontSize: 15, opacity: 0.9, maxWidth: 500 }}>
            Temu masalah infrastruktur? Laporkan lewat Jasida, biar langsung ditindaklanjuti oleh
            pihak berwenang.
          </p>
          <div>
            <button className="rw-hero-cta" style={btnHeroStyle} onClick={() => navigate('/lapor')}>
              Mulai Buat Laporan
              <span className="rw-cta-arrow" aria-hidden="true">
                ›
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <main style={{ width: '100%', padding: '0 5% 40px', boxSizing: 'border-box' }}>
        <h2
          className="rw-fade-in"
          style={{
            textAlign: 'center',
            fontSize: 22,
            fontWeight: 600,
            marginTop: 56,
            marginBottom: 36,
          }}
        >
          <span style={{ color: '#c92a2a' }}>Laporan</span>{' '}
          <span style={{ color: '#212529' }}>Kerusakan Terkini</span>
        </h2>

        {/* Filter Controls */}
        <div
          style={{
            display: 'flex',
            justifyContent: isMobileDevice ? 'center' : 'flex-end',
            gap: 10,
            marginBottom: 30,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <CustomSelect
            value={kecamatanFilter}
            onChange={setKecamatanFilter}
            options={kecamatanOptions}
            placeholder="Pilih Kecamatan"
          />

          <CustomDateRangePicker
            startDate={dateFrom}
            endDate={dateTo}
            onChange={(from, to) => {
              setDateFrom(from);
              setDateTo(to);
            }}
          />

          <button
            onClick={handleSearch}
            className="rw-btn-anim rw-search-btn"
            style={searchBtnStyle}
            aria-label="Cari"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="#fff" strokeWidth="2.2" />
              <line
                x1="21"
                y1="21"
                x2="16.2"
                y2="16.2"
                stroke="#fff"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {error && (
          <p className="rw-fade-in" style={{ textAlign: 'center', color: '#e03131' }}>
            {error}
          </p>
        )}
        {!loading && !error && filteredReports.length === 0 && (
          <p
            className="rw-fade-in"
            style={{ textAlign: 'center', color: '#868e96', margin: '40px 0' }}
          >
            {reports.length === 0
              ? 'Belum ada laporan.'
              : 'Tidak ada laporan yang cocok dengan filter.'}
          </p>
        )}

        {/* 3-Column Grid Layout */}
        <div style={gridStyle}>
          {loading &&
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={`skel-${i}`} />)}

          {!loading &&
            pagedReports.map((r, i) => (
              <ReportCard
                key={r.id}
                index={i}
                report={r}
                isOwner={user?.id === r.user_id}
                alreadySupported={mySupports.includes(r.id)}
                onSupported={() => markSupported(r.id)}
              />
            ))}
        </div>

        {/* Pagination Arrows */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginTop: 30,
            marginBottom: 60,
          }}
        >
          <button
            className="rw-page-btn"
            style={{
              ...pageArrowStyle,
              opacity: page === 0 ? 0.4 : 1,
              cursor: page === 0 ? 'default' : 'pointer',
            }}
            onClick={goPrevPage}
            disabled={page === 0}
            aria-label="Halaman sebelumnya"
          >
            <ChevronIcon direction="left" color="#a61e4d" size={16} />
          </button>
          <span style={{ fontSize: 13, color: '#868e96', minWidth: 60, textAlign: 'center' }}>
            <span key={page} className="rw-page-num">
              {page + 1} / {totalPages}
            </span>
          </span>
          <button
            className="rw-page-btn"
            style={{
              ...pageArrowStyle,
              opacity: page >= totalPages - 1 ? 0.4 : 1,
              cursor: page >= totalPages - 1 ? 'default' : 'pointer',
            }}
            onClick={goNextPage}
            disabled={page >= totalPages - 1}
            aria-label="Halaman berikutnya"
          >
            <ChevronIcon direction="right" color="#a61e4d" size={16} />
          </button>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Ikon                                                               */
/* ------------------------------------------------------------------ */
function PinIcon() {
  return (
    <svg
      className="rw-pin"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="#FDECEE"
      stroke="#A61C24"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.3" fill="#A61C24" stroke="none" />
    </svg>
  );
}

function ChevronIcon({ direction, color = '#fff', size = 16 }) {
  const points = direction === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points={points} />
    </svg>
  );
}

function ReporterIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, display: 'block' }}
      aria-hidden="true"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ThumbsUpIcon({ filled = false, pop = false }) {
  return (
    <svg
      className={`rw-thumb${pop ? ' rw-thumb-pop' : ''}`}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="M7 10v11" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h2.76a2 2 0 0 0 1.79-1.11L12 3a1.5 1.5 0 0 1 3 1.5v1.38z" />
    </svg>
  );
}

/**
 * Ikon komentar (gelembung chat dengan tiga titik).
 * Dipakai di CommentSection.jsx supaya konsisten, contoh:
 *   import { CommentIcon } from '../pages/DashboardPage.jsx';
 * atau salin komponen ini ke file ikon bersama.
 */
export function CommentIcon({ size = 14 }) {
  return (
    <svg
      className="rw-comment-icon-bubble"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6A8.4 8.4 0 0 1 12.5 3H13a8.5 8.5 0 0 1 8 8v.5z" />
      <circle cx="8.5" cy="11.5" r="0.6" fill="currentColor" />
      <circle cx="12" cy="11.5" r="0.6" fill="currentColor" />
      <circle cx="15.5" cy="11.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Status                                                             */
/* ------------------------------------------------------------------ */
const DASHBOARD_STATUS_INFO = {
  open: { label: 'Menunggu Verifikasi', bg: '#f1f3f5', color: '#868e96' },
  accepted: { label: 'Diterima', bg: '#E7F1FF', color: '#1c5dcf' },
  in_progress: { label: 'Sedang Diperbaiki', bg: '#fff3bf', color: '#996a00' },
  resolved: { label: 'Sudah Dikerjakan', bg: '#d3f9d8', color: '#2b8a3e' },
  rejected: { label: 'Ditolak', bg: '#FDECEE', color: '#A61C24' },
};

function reportStatusInfo(status) {
  return DASHBOARD_STATUS_INFO[status] ?? DASHBOARD_STATUS_INFO.open;
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */
function SkeletonCard() {
  return (
    <div style={{ ...cardStyle, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }} aria-hidden="true">
      <div className="rw-skel" style={{ height: 220, borderRadius: 0 }} />
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <div className="rw-skel" style={{ height: 12, width: '55%' }} />
          <div className="rw-skel" style={{ height: 12, width: '25%' }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="rw-skel" style={{ height: 24, width: 80, borderRadius: 20 }} />
          <div className="rw-skel" style={{ height: 24, width: 80, borderRadius: 20 }} />
          <div className="rw-skel" style={{ height: 24, width: 60, borderRadius: 20 }} />
        </div>
        <div className="rw-skel" style={{ height: 70, borderRadius: 8 }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Kartu laporan                                                      */
/* ------------------------------------------------------------------ */
function ReportCard({ report, isOwner, alreadySupported, onSupported, index = 0 }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [supporting, setSupporting] = useState(false);
  const [justSupported, setJustSupported] = useState(false);
  const [address, setAddress] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    if (report.lat == null || report.lng == null) return;
    reverseGeocode(report.lat, report.lng)
      .then(setAddress)
      .catch(() => setAddress(`Sekardangan, Sidoarjo, Jawa Timur`));
  }, [report.lat, report.lng]);

  useEffect(() => {
    const originalPhoto = report.imageUrl
      ? [{ id: 'original', url: report.imageUrl, photo_type: 'original' }]
      : [];
    setPhotos(originalPhoto);
    setPhotoIndex(0);
    getReportPhotos(report.id)
      .then((extra) => setPhotos([...originalPhoto, ...extra]))
      .catch((err) => console.warn('[report-photos]', err.message));
  }, [report.id, report.imageUrl]);

  async function handleSupport() {
    if (!user) return navigate('/login');
    if (supporting || alreadySupported || isOwner) return;
    setSupporting(true);
    try {
      await supportReport(report.id);
      setJustSupported(true);
      onSupported();
      setTimeout(() => setJustSupported(false), 700);
    } catch (err) {
      console.warn('[support]', err.message);
    } finally {
      setSupporting(false);
    }
  }

  const currentPhoto = photos[photoIndex];

  function goPrev(e) {
    e.stopPropagation();
    setPhotoIndex((i) => (i - 1 + photos.length) % photos.length);
  }

  function goNext(e) {
    e.stopPropagation();
    setPhotoIndex((i) => (i + 1) % photos.length);
  }

  const PHOTO_TYPE_LABEL = {
    original: 'Sebelum',
    resolution: 'Sesudah',
    support: 'Dukungan',
  };

  const posterName = report.profile?.username?.trim() || 'Anonim';
  const posterInitial = posterName[0]?.toUpperCase() ?? 'A';
  const supportCount = report.support_count ?? 0;
  const reporterCount = report.reporter_count ?? 1;
  const statusInfo = reportStatusInfo(report.status);
  const supportDisabled = alreadySupported || isOwner;

  return (
    <article
      className="rw-card"
      style={{ ...cardStyle, animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      {/* Top Image Preview & Severity */}
      <div
        className="rw-photo-wrap"
        style={{
          position: 'relative',
          height: 220,
          backgroundColor: '#e9ecef',
          overflow: 'hidden',
        }}
      >
        {currentPhoto?.url ? (
          <div key={currentPhoto.url} className="rw-photo-fade">
            <ZoomableImage
              src={currentPhoto.url}
              alt="Kerusakan"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        ) : (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#adb5bd',
            }}
          >
            No Image
          </div>
        )}
        <div style={{ position: 'absolute', top: 8, left: 8 }}>
          <SeverityBadge severity={report.severity} score={report.hazard_score} />
        </div>

        {currentPhoto?.photo_type && photos.length > 1 && (
          <span key={currentPhoto.photo_type + photoIndex} className="rw-photo-badge" style={photoTypeBadge}>
            {PHOTO_TYPE_LABEL[currentPhoto.photo_type] ?? currentPhoto.photo_type}
          </span>
        )}

        {photos.length > 1 && (
          <>
            <button
              type="button"
              className="rw-photo-nav"
              onClick={goPrev}
              style={{ ...photoNavBtn, left: 8 }}
              aria-label="Foto sebelumnya"
            >
              <ChevronIcon direction="left" />
            </button>
            <button
              type="button"
              className="rw-photo-nav"
              onClick={goNext}
              style={{ ...photoNavBtn, right: 8 }}
              aria-label="Foto berikutnya"
            >
              <ChevronIcon direction="right" />
            </button>

            <div style={photoDotsRow}>
              {photos.map((p, i) => (
                <span
                  key={p.id ?? i}
                  style={{
                    ...photoDot,
                    opacity: i === photoIndex ? 1 : 0.4,
                    transform: i === photoIndex ? 'scale(1.3)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Details Section */}
      <div style={{ padding: 12, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
        >
          <span
            style={{
              fontSize: 11,
              color: '#495057',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <PinIcon /> {address || 'Sekardangan, Sidoarjo, Jawa Timur'}
          </span>

          <div style={posterBadge}>
            {report.profile?.avatar_url ? (
              <img src={report.profile.avatar_url} alt="" style={posterAvatarImg} />
            ) : (
              <span style={posterAvatar}>{posterInitial}</span>
            )}
            <span style={posterNameText}>{posterName}</span>
          </div>
        </div>

        {/* Dukung + Komentar + Status */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12 }}
        >
          <span className="rw-reporter" style={reporterBadge}>
            <ReporterIcon /> {reporterCount} Pelapor
          </span>

          <button
            onClick={handleSupport}
            disabled={supporting || supportDisabled}
            className="rw-btn-anim rw-dukung"
            style={supportDisabled ? dukungBadgeDisabled : dukungBadge}
            aria-pressed={alreadySupported}
            title={isOwner ? 'Kamu tidak bisa mendukung laporanmu sendiri' : undefined}
          >
            {supporting ? (
              <span className="rw-spinner" aria-hidden="true" />
            ) : (
              <ThumbsUpIcon filled={alreadySupported} pop={justSupported} />
            )}
            Dukung{' '}
            <span key={supportCount} className={justSupported ? 'rw-count-bump' : undefined}>
              {supportCount}+
            </span>
          </button>

          <span className="rw-comment-wrap">
            <CommentSection reportId={report.id} photoUrl={currentPhoto?.url} />
          </span>

          <span style={{ ...statusBadge, backgroundColor: statusInfo.bg, color: statusInfo.color }}>
            <span
              className={`rw-status-dot${report.status === 'in_progress' ? ' pulse' : ''}`}
              aria-hidden="true"
            />
            {statusInfo.label}
          </span>
        </div>

        {report.status === 'rejected' && report.rejection_reason && (
          <div className="rw-reject" style={rejectionReasonPill}>
            Alasan ditolak: {report.rejection_reason}
          </div>
        )}

        <div style={noteBox}>
          {report.note ? (
            <p style={{ fontSize: 12, color: '#495057', margin: 0, lineHeight: 1.4 }}>
              {report.note}
            </p>
          ) : (
            <p style={{ fontSize: 12, color: '#adb5bd', margin: 0, fontStyle: 'italic' }}>
              Tidak ada catatan tambahan.
            </p>
          )}
        </div>

        <p style={reportDateText}>
          Dilaporkan {new Date(report.created_at).toLocaleString('id-ID')}
        </p>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Style                                                              */
/* ------------------------------------------------------------------ */
const heroCardStyle = {
  backgroundColor: '#A42C2B',
  borderRadius: 12,
  margin: '50px 5% 0',
  padding: '24px 30px',
  display: 'flex',
  alignItems: 'center',
  overflow: 'visible',
  position: 'relative',
  minHeight: 140,
};

const heroIconStyle = {
  position: 'absolute',
  left: 10,
  top: -40,
  width: 350,
  height: 'auto',
  objectFit: 'contain',
  pointerEvents: 'none',
};

const btnHeroStyle = {
  backgroundColor: '#ffffff',
  color: '#A42C2B',
  border: 'none',
  padding: '8px 16px',
  borderRadius: 20,
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
};

const searchBtnStyle = {
  backgroundColor: '#A42C2B',
  border: 'none',
  width: 44,
  height: 44,
  borderRadius: 12,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 20,
};

const cardStyle = {
  backgroundColor: '#ffffff',
  borderRadius: 12,
  overflow: 'hidden',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  display: 'flex',
  flexDirection: 'column',
  height: 500,
};

const noteBox = {
  marginTop: 10,
  flex: 1,
  overflowY: 'auto',
  background: '#f1f3f5',
  borderRadius: 8,
  padding: '10px 12px',
};

const reportDateText = {
  fontSize: 11,
  color: '#adb5bd',
  margin: '8px 0 0',
};

const photoTypeBadge = {
  position: 'absolute',
  top: 8,
  right: 8,
  background: 'rgba(0,0,0,0.6)',
  color: '#fff',
  fontSize: 10.5,
  fontWeight: 700,
  padding: '4px 10px',
  borderRadius: 999,
};

const photoNavBtn = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 30,
  height: 30,
  borderRadius: '50%',
  border: 'none',
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

const photoDotsRow = {
  position: 'absolute',
  bottom: 8,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: 5,
};

const photoDot = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: '#fff',
  transition: 'transform 0.2s ease, opacity 0.2s ease',
};

const posterBadge = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexShrink: 0,
};

const posterAvatar = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  backgroundColor: '#a61e4d',
  color: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 10,
  fontWeight: 700,
  flexShrink: 0,
};

const posterAvatarImg = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  objectFit: 'cover',
  flexShrink: 0,
};

const posterNameText = {
  fontSize: 11,
  fontWeight: 600,
  color: '#343a40',
  whiteSpace: 'nowrap',
};

const reporterBadge = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  backgroundColor: '#f1f3f5',
  color: '#495057',
  padding: '5px 12px',
  borderRadius: 20,
  fontWeight: 700,
  fontSize: 11,
  whiteSpace: 'nowrap',
};

// Badge "👍 Dukung {n}+"
const dukungBadge = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  backgroundColor: '#FDECEE',
  color: '#a61e4d',
  border: 'none',
  padding: '5px 12px',
  borderRadius: 20,
  fontWeight: 700,
  fontSize: 11,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const dukungBadgeDisabled = {
  ...dukungBadge,
  backgroundColor: '#f1f3f5',
  color: '#868e96',
  cursor: 'default',
};

const statusBadge = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '5px 12px',
  borderRadius: 20,
  fontWeight: 700,
  fontSize: 11,
  whiteSpace: 'nowrap',
  transition: 'background-color 0.3s ease, color 0.3s ease',
};

const rejectionReasonPill = {
  marginTop: 8,
  fontSize: 11.5,
  fontWeight: 600,
  color: '#A61C24',
  background: '#FDECEE',
  padding: '8px 12px',
  borderRadius: 8,
  lineHeight: 1.4,
};

const pageArrowStyle = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  border: '1px solid #dee2e6',
  backgroundColor: '#ffffff',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
};