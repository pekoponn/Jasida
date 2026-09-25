import { useEffect, useState } from 'react';
import { fetchPendingDuplicateReviews, resolveDuplicateReview } from '../lib/reports.js';
import { damageTypeDisplayLabel, severityDisplayLabel } from '../ai/hazardScore.js';
import ZoomableImage from '../components/ZoomableImage.jsx';
import ReportEvidenceGallery from '../components/ReportEvidenceGallery.jsx';

export default function AdminDoubleCheckPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPendingDuplicateReviews();
      setItems(data);
    } catch (err) {
      console.error(err);
      setError('Gagal memuat data double check: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(reportId, aiCorrect) {
    setBusyId(reportId);
    try {
      await resolveDuplicateReview(reportId, aiCorrect);
      setItems((prev) => prev.filter((it) => it.id !== reportId));
    } catch (err) {
      alert('Gagal memproses validasi: ' + err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <h1 className="display" style={{ fontSize: 24, marginBottom: 4 }}>
        Double Check
      </h1>
      <p style={{ color: '#868e96', marginTop: 0, fontSize: 14 }}>
        Validasi laporan yang pelapor tandai sebagai "kerusakan berbeda", padahal AI mendeteksinya
        mirip dengan laporan lain.
      </p>

      {error && <p style={{ color: '#e03131', marginTop: 12 }}>{error}</p>}
      {loading && <p style={{ marginTop: 12 }}>Memuat…</p>}

      {!loading && items.length === 0 && (
        <div style={emptyState}>Tidak ada laporan yang menunggu validasi saat ini.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
        {items.map((item) => (
          <ReviewCard
            key={item.id}
            item={item}
            busy={busyId === item.id}
            onResolve={(aiCorrect) => handleResolve(item.id, aiCorrect)}
          />
        ))}
      </div>
    </section>
  );
}

function ReviewCard({ item, busy, onResolve }) {
  const candidate = item.candidate;
  const matchPct =
    typeof item.duplicate_similarity === 'number'
      ? Math.round(item.duplicate_similarity * 100)
      : null;
  const distance =
    typeof item.duplicate_distance_m === 'number' ? Math.round(item.duplicate_distance_m) : null;

  return (
    <div style={cardStyle}>
      <div style={metaRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {item.profile?.avatar_url ? (
            <img src={item.profile.avatar_url} alt="" style={avatarImg} />
          ) : (
            <span style={avatarFallback}>{(item.profile?.username?.[0] ?? '?').toUpperCase()}</span>
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {item.profile?.username ?? 'Anonim'}
            </div>
            <div style={{ fontSize: 12, color: '#868e96' }}>
              Melaporkan pada {new Date(item.created_at).toLocaleString('id-ID')}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {matchPct !== null && <span style={infoPill}>Kecocokan AI: {matchPct}%</span>}
          {distance !== null && <span style={infoPill}>Jarak: {distance} m</span>}
        </div>
      </div>

      <div style={photoCompareGrid}>
        <div>
          <div style={photoLabel}>Foto Laporan Baru (klaim: berbeda)</div>
          <ZoomableImage
            src={item.imageUrl || 'https://placehold.co/400x260?text=Tidak+ada+foto'}
            alt="Foto laporan baru"
            style={photoStyle}
          />
          <ReportEvidenceGallery reportId={item.id} />
          <div style={{ marginTop: 8, fontSize: 12.5, color: '#495057' }}>
            {item.damage_type && <div>{damageTypeDisplayLabel(item.damage_type)}</div>}
            {item.severity && (
              <div>
                {severityDisplayLabel(item.severity)} · Skor {item.hazard_score}
              </div>
            )}
            {item.address && <div style={{ color: '#868e96', marginTop: 4 }}>{item.address}</div>}
            {item.note && <div style={{ marginTop: 4, fontStyle: 'italic' }}>"{item.note}"</div>}
          </div>
        </div>

        <div>
          <div style={photoLabel}>Foto Laporan Existing (dianggap AI mirip)</div>
          {candidate ? (
            <>
              <ZoomableImage
                src={candidate.imageUrl || 'https://placehold.co/400x260?text=Tidak+ada+foto'}
                alt="Foto laporan existing"
                style={photoStyle}
              />
              <ReportEvidenceGallery reportId={candidate.id} />
              <div style={{ marginTop: 8, fontSize: 12.5, color: '#495057' }}>
                {candidate.damage_type && (
                  <div>{damageTypeDisplayLabel(candidate.damage_type)}</div>
                )}
                {candidate.severity && (
                  <div>
                    {severityDisplayLabel(candidate.severity)} · Skor {candidate.hazard_score}
                  </div>
                )}
                {candidate.address && (
                  <div style={{ color: '#868e96', marginTop: 4 }}>{candidate.address}</div>
                )}
              </div>
            </>
          ) : (
            <div style={{ ...photoStyle, ...placeholderBox }}>
              Laporan pembanding sudah tidak tersedia (mungkin sudah dihapus/diproses).
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button
          style={{ ...actionBtn, background: '#e03131' }}
          disabled={busy}
          onClick={() => onResolve(true)}
        >
          Laporan Sama
        </button>
        <button
          style={{ ...actionBtn, background: '#2f9e44' }}
          disabled={busy}
          onClick={() => onResolve(false)}
        >
          Laporan Beda
        </button>
      </div>
      <p style={{ fontSize: 11.5, color: '#adb5bd', marginTop: 8, marginBottom: 0 }}>
        "AI Benar" akan membatalkan laporan baru ini dan menambahkan pelapor ke laporan existing.
        "AI Salah" akan membuat laporan baru ini resmi (status Menunggu Verifikasi) dan muncul di
        Kelola Laporan &amp; Daftar Laporan.
      </p>
    </div>
  );
}

const emptyState = {
  marginTop: 20,
  padding: 40,
  textAlign: 'center',
  color: '#868e96',
  background: '#fff',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(25,27,31,0.06), 0 4px 16px rgba(25,27,31,0.06)',
};

const cardStyle = {
  background: '#fff',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(25,27,31,0.06), 0 4px 16px rgba(25,27,31,0.06)',
  padding: 20,
};

const metaRow = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 12,
  marginBottom: 16,
};

const avatarImg = { width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 };
const avatarFallback = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  background: '#A61C24',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 13,
  fontWeight: 700,
  flexShrink: 0,
};

const infoPill = {
  fontSize: 12,
  fontWeight: 600,
  color: '#A61C24',
  background: '#FDECEE',
  padding: '5px 12px',
  borderRadius: 999,
};

const photoCompareGrid = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 20,
};

const photoLabel = { fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#495057' };
const photoStyle = {
  width: '100%',
  height: 200,
  objectFit: 'cover',
  borderRadius: 10,
  display: 'block',
};
const placeholderBox = {
  background: '#f8f9fa',
  border: '1px dashed #dee2e6',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#adb5bd',
  fontSize: 12,
  textAlign: 'center',
  padding: 12,
};

const actionBtn = {
  flex: 1,
  padding: '11px 16px',
  borderRadius: 8,
  border: 'none',
  color: '#fff',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};
