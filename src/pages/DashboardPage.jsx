import { useEffect, useRef, useState } from 'react';
import { listReportsFeed, supportReport, getMySupports, getReportPhotos } from '../lib/reports.js';
import SeverityBadge from '../components/SeverityBadge.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { reverseGeocode } from '../lib/geolocation.js';
import CommentSection from '../components/CommentSection.jsx';

const STATUS_LABEL = { open: 'Belum diproses', in_progress: 'Diproses', resolved: 'Selesai' };
const STATUS_COLOR = { open: '#868e96', in_progress: '#f08c00', resolved: '#2f9e44' };

export default function DashboardPage() {
  const [reports, setReports] = useState([]);
  const [mySupports, setMySupports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();

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

  return (
    <section>
      <h1 className="display" style={{ fontSize: 24, marginBottom: 4 }}>Laporan warga</h1>
      <p style={{ color: 'var(--color-ink-soft)', marginTop: 0, fontSize: 14 }}>
        Semua laporan kerusakan jalan dari warga sekitar.
      </p>

      {loading && <p style={{ marginTop: 20 }}>Memuat…</p>}
      {error && <p style={{ color: 'var(--sev-emergency)' }}>{error}</p>}
      {!loading && !error && reports.length === 0 && (
        <p style={{ marginTop: 20, color: 'var(--color-ink-soft)' }}>Belum ada laporan.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
        {reports.map((r) => (
          <ReportCard
            key={r.id}
            report={r}
            isOwner={user?.id === r.user_id}
            alreadySupported={mySupports.includes(r.id)}
            onSupported={() => markSupported(r.id)}
          />
        ))}
      </div>
    </section>
  );
}

function ReportCard({ report, isOwner, alreadySupported, onSupported }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [supporting, setSupporting] = useState(false);
  const [address, setAddress] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [index, setIndex] = useState(0);
  const touchStartX = useRef(null);

  useEffect(() => {
    if (report.lat == null || report.lng == null) return;
    reverseGeocode(report.lat, report.lng)
      .then(setAddress)
      .catch(() => setAddress(`${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}`));
  }, [report.lat, report.lng]);

  useEffect(() => {
    const originalPhoto = report.imageUrl ? [{ id: 'original', url: report.imageUrl, photo_type: 'original' }] : [];
    setPhotos(originalPhoto);
    getReportPhotos(report.id)
      .then((extra) => setPhotos([...originalPhoto, ...extra]))
      .catch((err) => console.warn('[report-photos]', err.message));
  }, [report.id, report.imageUrl]);

  function goTo(i) {
    if (!photos.length) return;
    setIndex((i + photos.length) % photos.length);
  }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40) {
      goTo(delta > 0 ? index - 1 : index + 1);
    }
    touchStartX.current = null;
  }

  async function handleSupport() {
    if (!user) {
      navigate('/login');
      return;
    }
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

  const supportLabel = isOwner
    ? 'Laporan sendiri'
    : alreadySupported
    ? 'Didukung'
    : 'Dukung';

  const currentPhoto = photos[index];

  return (
    <article style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
        <div style={avatar}>
          {report.profile?.avatar_url ? (
            <img src={report.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          ) : (
            (report.profile?.username?.[0] ?? '?').toUpperCase()
          )}
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{report.profile?.username ?? 'Warga'}</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-ink-soft)' }}>
            {new Date(report.created_at).toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      {photos.length > 0 && (
        <div
          style={photoWrap}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <img src={currentPhoto.url} alt="Kerusakan jalan" style={photoImg} />

          {currentPhoto.photo_type === 'resolution' && (
            <span style={resolutionTag}>✅ Bukti perbaikan</span>
          )}

          {photos.length > 1 && (
            <>
              <button style={{ ...arrowBtn, left: 8 }} onClick={() => goTo(index - 1)} aria-label="Foto sebelumnya">‹</button>
              <button style={{ ...arrowBtn, right: 8 }} onClick={() => goTo(index + 1)} aria-label="Foto berikutnya">›</button>
              <div style={dotsRow}>
                {photos.map((_, i) => (
                  <span key={i} style={{ ...dot, opacity: i === index ? 1 : 0.35 }} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {address && (
        <p style={{ fontSize: 12.5, color: 'var(--color-ink-soft)', padding: '10px 14px 0', margin: 0 }}>
          📍 {address}
        </p>
      )}

      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>
            {report.damage_type?.replaceAll('_', ' ')}
          </span>
          <SeverityBadge severity={report.severity} score={report.hazard_score} />
        </div>

        {report.note && (
          <p style={{ marginTop: 8, marginBottom: 0, fontSize: 14 }}>{report.note}</p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <button
            onClick={handleSupport}
            disabled={supporting || alreadySupported || isOwner}
            style={alreadySupported || isOwner ? supportBtnActive : supportBtn}
          >
            👍 {supportLabel} · {report.support_count ?? 0}
          </button>
          <span style={{ ...statusBadge, background: STATUS_COLOR[report.status] ?? '#868e96' }}>
            {STATUS_LABEL[report.status] ?? report.status}
          </span>
        </div>

        <CommentSection reportId={report.id} />
      </div>
    </article>
  );
}

const card = {
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-card)',
  overflow: 'hidden'
};

const avatar = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  background: 'var(--color-accent)',
  color: 'var(--color-accent-ink)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
  overflow: 'hidden',
  flexShrink: 0
};

const photoWrap = {
  position: 'relative',
  background: '#000'
};

const photoImg = { width: '100%', display: 'block' };

const resolutionTag = {
  position: 'absolute',
  top: 10,
  left: 10,
  background: 'rgba(47,158,68,0.92)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  padding: '4px 10px',
  borderRadius: 999
};

const arrowBtn = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 32,
  height: 32,
  borderRadius: '50%',
  border: 'none',
  background: 'rgba(0,0,0,0.45)',
  color: '#fff',
  fontSize: 18,
  lineHeight: 1,
  cursor: 'pointer'
};

const dotsRow = {
  position: 'absolute',
  bottom: 8,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  gap: 5
};

const dot = { width: 6, height: 6, borderRadius: '50%', background: '#fff' };

const supportBtn = {
  padding: '6px 14px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer'
};

const supportBtnActive = {
  ...supportBtn,
  background: 'var(--color-primary)',
  color: 'var(--color-primary-ink)',
  border: 'none',
  cursor: 'default'
};

const statusBadge = {
  fontSize: 12,
  fontWeight: 700,
  color: '#fff',
  padding: '4px 10px',
  borderRadius: 999
};