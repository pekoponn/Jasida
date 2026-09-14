import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { damageTypeDisplayLabel, severityDisplayLabel } from '../ai/hazardScore.js';
import { listMyReports } from '../lib/reports.js';
import { useIsMobileDevice } from '../lib/useIsMobileDevice.js';
import ReportDetailModal from '../components/ReportDetailModal.jsx';

const STATUS_TABS = [
  { key: 'semua', label: 'Semua' },
  { key: 'open', label: 'Menunggu Verifikasi' },
  { key: 'in_progress', label: 'Diproses' },
  { key: 'resolved', label: 'Selesai' },
  { key: 'rejected', label: 'Ditolak' }
];

const STATUS_META = {
  open: { label: 'Menunggu Verifikasi', bg: '#FFF3CD', color: '#8A6D00' },
  accepted: { label: 'Diterima', bg: '#E7F1FF', color: '#1c5dcf' },
  in_progress: { label: 'Diproses', bg: '#E3F1FD', color: '#1c7ed6' },
  resolved: { label: 'Selesai', bg: '#E6F8EC', color: '#1c8a4b' },
  rejected: { label: 'Ditolak', bg: '#FDECEE', color: '#A61C24' }
};

export default function RiwayatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobileDevice = useIsMobileDevice();
  const [activeTab, setActiveTab] = useState('semua');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    listMyReports()
      .then(setReports)
      .catch((err) => {
        console.error(err);
        setError('Gagal memuat riwayat laporan.');
      })
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = useMemo(() => {
    if (activeTab === 'semua') return reports;
    return reports.filter((r) => r.status === activeTab);
  }, [reports, activeTab]);

  if (!user) {
    return (
      <section style={{ textAlign: 'center', padding: '100px 20px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 12px' }}>Masuk untuk melihat riwayat laporanmu</h2>
        <button onClick={() => navigate('/login')} style={primaryBtn}>Masuk Sekarang</button>
      </section>
    );
  }

  return (
    <section className="riwayat-page" style={{ paddingBottom: isMobileDevice ? 90 : 24 }}>
      <style>{responsiveCss}</style>
      <h1 className="display riwayat-title" style={titleStyle}>Riwayat Laporan</h1>

      <div className="riwayat-tabs" style={tabsRow}>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={activeTab === tab.key ? tabActive : tabInactive}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: 'var(--color-ink-soft)' }}>Memuat riwayat…</p>}
      {error && <p style={{ color: '#A61C24' }}>{error}</p>}
      {!loading && !error && filtered.length === 0 && (
        <p style={{ color: '#868e96', marginTop: 24 }}>Belum ada laporan untuk kategori ini.</p>
      )}

      <div className="riwayat-list" style={{ marginTop: 8 }}>
        {filtered.map((report) => (
          <ReportCard key={report.id} report={report} onViewDetail={() => setSelectedReport(report)} />
        ))}
      </div>

      <ReportDetailModal report={selectedReport} onClose={() => setSelectedReport(null)} />
    </section>
  );
}

function ReportCard({ report, onViewDetail }) {
  const meta = STATUS_META[report.status] ?? STATUS_META.open;
  const scorePct = Math.round(report.hazard_score ?? 0);
  const severityLabel = report.severity ? severityDisplayLabel(report.severity) : '—';
  const sevColor = severityColor(report.severity);

  return (
    <div className="riwayat-card" style={cardStyle}>
      <div className="riwayat-card-top" style={cardTopStyle}>
        <button type="button" onClick={onViewDetail} style={detailLink}>
          Lihat Detail <ArrowIcon />
        </button>
      </div>

      <div className="riwayat-row" style={rowStyle}>
        <img
          src={report.imageUrl || 'https://placehold.co/160x120?text=Foto'}
          alt=""
          className="riwayat-photo"
          style={photoStyle}
        />

        <div className="riwayat-info" style={infoStyle}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>#{String(report.id).slice(0, 8).toUpperCase()}</div>
          <div style={metaLine}>
            <PinIcon />
            {typeof report.lat === 'number' && typeof report.lng === 'number'
              ? `${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}`
              : 'Lokasi tidak tersedia'}
          </div>
          <div style={metaLine}>
            <CalendarIcon />
            Dilaporkan pada {formatDate(report.created_at)}
          </div>
          {report.damage_type && (
            <div style={{ ...metaLine, marginTop: 4 }}>{damageTypeDisplayLabel(report.damage_type)}</div>
          )}
        </div>

        <div className="riwayat-divider" style={dividerStyle} />

        <div className="riwayat-score" style={scoreColStyle}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Tingkat Kerusakan</div>
          <div style={progressRow}>
            <div style={progressTrack}>
              <div style={{ ...progressFill, width: `${Math.min(scorePct, 100)}%` }} />
            </div>
            <span style={progressPctText}>{scorePct}%</span>
          </div>
          <span style={{ ...severityPill, background: sevColor.bg, color: sevColor.color }}>{severityLabel}</span>
        </div>

        <div className="riwayat-divider" style={dividerStyle} />

        <div className="riwayat-actions" style={actionsColStyle}>
          <span style={{ ...statusPill, background: meta.bg, color: meta.color }}>{meta.label}</span>
        </div>
      </div>
    </div>
  );
}

function severityColor(severity) {
  const normalized = (severity ?? '').toString().trim().toLowerCase();
  if (['aman', 'low', 'ringan'].includes(normalized)) {
    return { bg: '#E6F8EC', color: '#2f9e44' };
  }
  if (['sedang', 'medium'].includes(normalized)) {
    return { bg: '#FFF3CD', color: '#e8830c' };
  }
  return { bg: '#FDECEE', color: '#A61C24' };
}

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

/* --- Ikon-ikon kecil --- */
function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A61C24" strokeWidth="2" style={{ flexShrink: 0 }}>
      <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#868e96" strokeWidth="2" style={{ flexShrink: 0 }}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" strokeLinecap="round" />
      <line x1="16" y1="3" x2="16" y2="7" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
      <polyline points="12 5 19 12 12 19" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* --- CSS responsif --- */
/* Pakai CSS grid (bukan flex) supaya kolom status TIDAK PERNAH bisa ke-dorong
   keluar dari batas card — grid selalu membagi lebar sesuai container, flex
   dengan kolom fixed-width bisa overflow kalau ruang kurang. */
const responsiveCss = `
  .riwayat-tabs { display: flex; flex-wrap: wrap; gap: 10px; }

  .riwayat-row {
    display: grid;
    grid-template-columns: 230px minmax(160px, 1fr) 1px 300px 1px auto;
    align-items: center;
    gap: 24px;
  }

  .riwayat-divider { width: 1px; align-self: stretch; background: #eee; }

  @media (max-width: 860px) {
    .riwayat-title { font-size: 22px !important; }
    .riwayat-card { padding: 16px !important; }
    .riwayat-row {
      grid-template-columns: 1fr !important;
      gap: 14px !important;
    }
    .riwayat-divider { display: none !important; }
    .riwayat-photo { width: 100% !important; height: 160px !important; }
    .riwayat-actions { align-items: flex-start !important; }
  }
`;

/* --- Style objects --- */
const titleStyle = { fontSize: 28, marginBottom: 24 };

const tabsRow = { marginBottom: 24 };

const tabBase = {
  padding: '11px 24px',
  borderRadius: 10,
  fontSize: 13.5,
  fontWeight: 600,
  cursor: 'pointer',
  border: '1.5px solid #A61C24',
  background: '#fff',
  color: '#A61C24',
  whiteSpace: 'nowrap'
};
const tabActive = { ...tabBase, background: '#A61C24', color: '#fff' };
const tabInactive = { ...tabBase };

const cardStyle = {
  background: '#fff',
  borderRadius: 14,
  boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
  padding: '20px 24px',
  marginBottom: 18
};

const cardTopStyle = { display: 'flex', justifyContent: 'flex-end', marginBottom: 12 };

/* rowStyle sengaja kosong dari width/flex — layout kolomnya sekarang
   sepenuhnya diatur oleh .riwayat-row (grid-template-columns) di responsiveCss */
const rowStyle = {};

const photoStyle = { width: '100%', height: 140, objectFit: 'cover', borderRadius: 10, display: 'block' };
const infoStyle = { minWidth: 0 };
const metaLine = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#666', marginTop: 6 };

const dividerStyle = {};

const scoreColStyle = { minWidth: 0 };
const progressRow = { display: 'flex', alignItems: 'center', gap: 10 };
const progressTrack = { flex: 1, position: 'relative', height: 6, borderRadius: 999, background: '#f1c9c9', overflow: 'hidden' };
const progressFill = { position: 'absolute', top: 0, left: 0, bottom: 0, background: '#C0292E', borderRadius: 999 };
const progressPctText = { fontSize: 13, fontWeight: 600, color: '#333', flexShrink: 0 };
const severityPill = {
  display: 'inline-block',
  marginTop: 10,
  fontSize: 12.5,
  fontWeight: 700,
  color: '#A61C24',
  background: '#FDECEE',
  padding: '5px 14px',
  borderRadius: 999
};

const actionsColStyle = { display: 'flex', alignItems: 'center', justifySelf: 'end' };
const statusPill = { fontSize: 13, fontWeight: 700, padding: '8px 18px', borderRadius: 999, whiteSpace: 'nowrap' };
const detailLink = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12.5,
  fontWeight: 700,
  color: '#A61C24',
  background: '#fff',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  border: '1.5px solid #A61C24',
  borderRadius: 999,
  padding: '6px 16px',
  cursor: 'pointer'
};

const primaryBtn = {
  padding: '13px 32px',
  borderRadius: 8,
  border: 'none',
  background: '#A61C24',
  color: '#fff',
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer'
};