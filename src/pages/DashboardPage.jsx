import { useEffect, useMemo, useRef, useState } from 'react';
import { listReportsFeed, supportReport, getMySupports, getReportPhotos } from '../lib/reports.js';
import SeverityBadge from '../components/SeverityBadge.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { reverseGeocode } from '../lib/geolocation.js';
import CommentSection from '../components/CommentSection.jsx';
import { findKecamatan, getKecamatanNames } from '../lib/kecamatanBoundaries.js';
import roadIcon from '../assets/RoadIcon.png';
import { useIsMobileDevice } from '../lib/useIsMobileDevice.js';
import CustomSelect from '../components/CustomSelect.jsx';
import CustomDateRangePicker from '../components/CustomDateRangePicker.jsx';

export default function DashboardPage() {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .rw-btn-anim {
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .rw-btn-anim:hover:not(:disabled) {
        transform: translateY(-2px) scale(1.04);
        box-shadow: 0 3px 8px rgba(0,0,0,0.12);
      }
      .rw-btn-anim:active:not(:disabled) {
        transform: scale(0.96);
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
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
        const nama = typeof r.lat === 'number' && typeof r.lng === 'number'
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

  return (
    <div style={{ backgroundColor: 'var(--color-bg, #f8f9fa)', minHeight: '100vh' }}>
    {/* Hero Banner Red Header */}
      <section
        style={{
          ...heroCardStyle,
          flexDirection: isMobileDevice ? 'column' : 'row',
          textAlign: isMobileDevice ? 'center' : 'left',
          margin: isMobileDevice ? '20px 5% 0' : heroCardStyle.margin,
          padding: isMobileDevice ? '28px 20px 24px' : heroCardStyle.padding,
          minHeight: isMobileDevice ? 'auto' : heroCardStyle.minHeight
        }}
      >
        {!isMobileDevice && (
          <img
            src={roadIcon}
            alt="Jalan"
            style={heroIconStyle}
            onError={(e) => (e.target.style.display = 'none')}
          />
        )}
        <div style={{ color: '#ffffff', marginLeft: isMobileDevice ? 0 : 350, marginTop: isMobileDevice ? 10 : 0 }}>
          <h2 style={{ margin: 0, fontSize: 30, fontWeight: 450 }}>
            Bersama Jaga Sidoarjo. Laporkan Sekarang!
          </h2>
          <p style={{ margin: '10px 0 18px', fontSize: 15, opacity: 0.9, maxWidth: 500 }}>
            Temu masalah infrastruktur? Laporkan lewat Jasida, biar langsung ditindaklanjuti oleh pihak berwenang.
          </p>
          <button style={btnHeroStyle} onClick={() => navigate('/lapor')}>Mulai Buat Laporan</button>
        </div>
      </section>

      {/* Main Container */}
      <main style={{ width: '100%', padding: '0 5% 40px', boxSizing: 'border-box' }}>
        <h2 style={{ textAlign: 'center', fontSize: 22, fontWeight: 600, marginTop: 56, marginBottom: 36 }}>
          <span style={{ color: '#c92a2a' }}>Laporan</span>{' '}
          <span style={{ color: '#212529' }}>Kerusakan Terkini</span>
        </h2>

                {/* Filter Controls */}
        <div style={{ display: 'flex', justifyContent: isMobileDevice ? 'center' : 'flex-end', gap: 10, marginBottom: 30, flexWrap: 'wrap', alignItems: 'center' }}>
          <CustomSelect
            value={kecamatanFilter}
            onChange={setKecamatanFilter}
            options={kecamatanOptions}
            placeholder="Pilih Kecamatan"
          />

          <CustomDateRangePicker
            startDate={dateFrom}
            endDate={dateTo}
            onChange={(from, to) => { setDateFrom(from); setDateTo(to); }}
          />

          <button onClick={handleSearch} className="rw-btn-anim" style={searchBtnStyle} aria-label="Cari">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="#fff" strokeWidth="2.2" />
              <line x1="21" y1="21" x2="16.2" y2="16.2" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {loading && <p style={{ textAlign: 'center', margin: '40px 0' }}>Memuat…</p>}
        {error && <p style={{ textAlign: 'center', color: '#e03131' }}>{error}</p>}
        {!loading && !error && filteredReports.length === 0 && (
          <p style={{ textAlign: 'center', color: '#868e96', margin: '40px 0' }}>
            {reports.length === 0 ? 'Belum ada laporan.' : 'Tidak ada laporan yang cocok dengan filter.'}
          </p>
        )}

        {/* 3-Column Grid Layout */}
        <div style={gridStyle}>
          {filteredReports.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              isOwner={user?.id === r.user_id}
              alreadySupported={mySupports.includes(r.id)}
              onSupported={() => markSupported(r.id)}
            />
          ))}
        </div>

        {/* Pagination Arrows */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 30 }}>
          <button style={pageArrowStyle}>‹</button>
          <button style={pageArrowStyle}>›</button>
        </div>
      </main>
    </div>
  );
}

function reportStatusInfo(status) {
  const normalized = (status ?? '').toString().trim().toLowerCase();

  const doneValues = ['selesai', 'done', 'resolved', 'sudah_dikerjakan', 'diperbaiki'];
  const inProgressValues = ['diproses', 'in_progress', 'sedang_diperbaiki', 'diperbaiki_sebagian'];

  if (doneValues.includes(normalized)) {
    return { label: 'Sudah Dikerjakan', bg: '#d3f9d8', color: '#2b8a3e' };
  }
  if (inProgressValues.includes(normalized)) {
    return { label: 'Sedang Diperbaiki', bg: '#fff3bf', color: '#996a00' };
  }
  return { label: 'Belum Dikerjakan', bg: '#f1f3f5', color: '#868e96' };
}

function ReportCard({ report, isOwner, alreadySupported, onSupported }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [supporting, setSupporting] = useState(false);
  const [address, setAddress] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (report.lat == null || report.lng == null) return;
    reverseGeocode(report.lat, report.lng)
      .then(setAddress)
      .catch(() => setAddress(`Sekardangan, Sidoarjo, Jawa Timur`));
  }, [report.lat, report.lng]);

  useEffect(() => {
    const originalPhoto = report.imageUrl ? [{ id: 'original', url: report.imageUrl, photo_type: 'original' }] : [];
    setPhotos(originalPhoto);
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
      onSupported();
    } catch (err) {
      console.warn('[support]', err.message);
    } finally {
      setSupporting(false);
    }
  }

  const currentPhoto = photos[index];

  const posterName = report.profile?.username?.trim() || 'Anonim';
  const posterInitial = posterName[0]?.toUpperCase() ?? 'A';
  const supportCount = report.support_count ?? 0;
  const statusInfo = reportStatusInfo(report.status);

  return (
    <article style={cardStyle}>
      {/* Top Image Preview & Severity */}
      <div style={{ position: 'relative', height: 220, backgroundColor: '#e9ecef', overflow: 'hidden' }}>
        {currentPhoto?.url ? (
          <img src={currentPhoto.url} alt="Kerusakan" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#adb5bd' }}>
            No Image
          </div>
        )}
        <div style={{ position: 'absolute', top: 8, left: 8 }}>
          <SeverityBadge severity={report.severity} score={report.hazard_score} />
        </div>
      </div>

      {/* Details Section */}
      <div style={{ padding: 12, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#495057', display: 'flex', alignItems: 'center', gap: 4 }}>
            📍 {address || 'Sekardangan, Sidoarjo, Jawa Timur'}
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

        {/* Dukung + Komentar + Status — dikasih jarak dari baris di atasnya */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button
            onClick={handleSupport}
            disabled={supporting || alreadySupported || isOwner}
            className="rw-btn-anim"
            style={alreadySupported || isOwner ? dukungBadgeDisabled : dukungBadge}
          >
            👍 Dukung {supportCount}+
          </button>

          <CommentSection reportId={report.id} photoUrl={currentPhoto?.url} />

          <span style={{ ...statusBadge, backgroundColor: statusInfo.bg, color: statusInfo.color }}>
            {statusInfo.label}
          </span>
        </div>

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

const heroCardStyle = {
  backgroundColor: '#A42C2B',
  borderRadius: 12,
  margin: '50px 5% 0',
  padding: '24px 30px',
  display: 'flex',
  alignItems: 'center',
  overflow: 'visible',
  position: 'relative',
  minHeight: 140
};

const heroIconStyle = {
  position: 'absolute',
  left: 10,
  top: -40,
  width: 350,
  height: 'auto',
  objectFit: 'contain',
  pointerEvents: 'none'
};

const btnHeroStyle = {
  backgroundColor: '#ffffff',
  color: '#a61e4d',
  border: 'none',
  padding: '8px 16px',
  borderRadius: 20,
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer'
};

const selectStyle = {
  padding: '10px 36px 10px 18px',
  borderRadius: 24,
  border: '1px solid #dee2e6',
  backgroundColor: '#ffffff',
  fontSize: 13,
  color: '#495057',
  outline: 'none',
  cursor: 'pointer',
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a61e4d' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  backgroundSize: '14px'
};

const dateRangeWrap = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 16px',
  borderRadius: 24,
  border: '1px solid #dee2e6',
  backgroundColor: '#ffffff'
};

const dateInputStyle = {
  border: 'none',
  outline: 'none',
  fontSize: 13,
  color: '#495057',
  fontFamily: 'inherit',
  padding: '4px 0',
  colorScheme: 'light',
  cursor: 'pointer'
};

const searchBtnStyle = {
  backgroundColor: '#a61e4d',
  border: 'none',
  width: 44,
  height: 44,
  borderRadius: 12,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 20
};

const cardStyle = {
  backgroundColor: '#ffffff',
  borderRadius: 12,
  overflow: 'hidden',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  display: 'flex',
  flexDirection: 'column',
  height: 500
};

const noteBox = {
  marginTop: 10,
  flex: 1,
  overflowY: 'auto',
  background: '#f1f3f5',
  borderRadius: 8,
  padding: '10px 12px'
};

const reportDateText = {
  fontSize: 11,
  color: '#adb5bd',
  margin: '8px 0 0'
};

const posterBadge = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexShrink: 0
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
  flexShrink: 0
};

const posterAvatarImg = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  objectFit: 'cover',
  flexShrink: 0
};

const posterNameText = {
  fontSize: 11,
  fontWeight: 600,
  color: '#343a40',
  whiteSpace: 'nowrap'
};

// Badge "👍 Dukung {n}+" — pengganti tombol "Kirim" yang dobel
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
  whiteSpace: 'nowrap'
};

const dukungBadgeDisabled = {
  ...dukungBadge,
  backgroundColor: '#f1f3f5',
  color: '#868e96',
  cursor: 'default'
};

const statusBadge = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '5px 12px',
  borderRadius: 20,
  fontWeight: 700,
  fontSize: 11,
  whiteSpace: 'nowrap'
};

const pageArrowStyle = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  border: '1px solid #dee2e6',
  backgroundColor: '#ffffff',
  color: '#a61e4d',
  fontWeight: 'bold',
  fontSize: 16,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};