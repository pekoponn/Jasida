import { useEffect, useRef, useState } from 'react';
import MapPreview from '../../components/MapPreview.jsx';
import { getReportPhotos, reportImageUrl } from '../../lib/reports.js';

export default function DuplicateModal({
  candidate,
  position,
  onSupport,
  onDispute,
  onClose,
  busy = false,
  pendingAction = null,
  error = null,
}) {
  const [photos, setPhotos] = useState([]);
  const [index, setIndex] = useState(0);
  const touchStartX = useRef(null);

  useEffect(() => {
    if (!candidate) return;

    setIndex(0);
    const originalPhoto = candidate.image_path
      ? [{ id: 'original', url: reportImageUrl(candidate.image_path) }]
      : [];
    setPhotos(originalPhoto);

    getReportPhotos(candidate.id)
      .then((extra) => setPhotos([...originalPhoto, ...extra]))
      .catch((err) => console.warn('[duplicate-photos]', err.message));
  }, [candidate]);

  if (!candidate) return null;
  const distance = Math.round(candidate.distance_m);
  const matchPct = Math.round(candidate.probability * 100);

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

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-labelledby="dup-title">
      <div style={panel}>
        <button
          style={closeBtn}
          disabled={busy || !!pendingAction}
          onClick={onClose}
          aria-label="Tutup"
        >
          ✕
        </button>

        <h3 id="dup-title" className="display" style={{ fontSize: 18, marginBottom: 4 }}>
          Laporan serupa ditemukan
        </h3>
        <p style={{ color: 'var(--color-ink-soft)', fontSize: 14, marginTop: 0 }}>
          Sepertinya ada laporan lain untuk kerusakan yang sama di dekat lokasi kamu.
        </p>

        <div style={mediaRow}>
          {photos.length > 0 && (
            <div style={mediaCol}>
              <div style={photoWrap} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                <img src={photos[index].url} alt="Foto laporan" style={photoImg} />

                {photos.length > 1 && (
                  <>
                    <button
                      style={{ ...arrowBtn, left: 8 }}
                      onClick={() => goTo(index - 1)}
                      aria-label="Foto sebelumnya"
                    >
                      ‹
                    </button>
                    <button
                      style={{ ...arrowBtn, right: 8 }}
                      onClick={() => goTo(index + 1)}
                      aria-label="Foto berikutnya"
                    >
                      ›
                    </button>
                    <div style={dotsRow}>
                      {photos.map((_, i) => (
                        <span key={i} style={{ ...dot, opacity: i === index ? 1 : 0.35 }} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {position && (
            <div style={mediaCol}>
              <MapPreview lat={position.lat} lng={position.lng} />
            </div>
          )}
        </div>

        <dl style={statGrid}>
          <div>
            <dt style={statLabel}>Jarak</dt>
            <dd style={statValue} className="mono">
              {distance} m
            </dd>
          </div>
          <div>
            <dt style={statLabel}>
              {candidate.match_basis === 'location' ? 'Pemeriksaan' : 'Skor kemiripan'}
            </dt>
            <dd style={statValue} className="mono">
              {candidate.match_basis === 'location' ? 'Lokasi & jenis' : `${matchPct}%`}
            </dd>
          </div>
          <div>
            <dt style={statLabel}>Dukungan</dt>
            <dd style={statValue} className="mono">
              {candidate.support_count}
            </dd>
          </div>
        </dl>
        {candidate.match_basis === 'location' && (
          <p style={{ fontSize: 13 }}>
            Jenis kerusakan sama dan lokasi berdekatan. Bandingkan foto untuk memastikan; laporan
            tidak digabung otomatis.
          </p>
        )}
        <p
          style={{ fontSize: 12.5, color: 'var(--color-ink-soft)', marginTop: 16, marginBottom: 0 }}
        >
          Apakah ini kerusakan yang sama dengan laporan di atas?
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button
            disabled={busy || pendingAction === 'dispute'}
            style={{ ...primaryBtn, flex: 1 }}
            onClick={() => onSupport(candidate)}
          >
            {busy ? 'Memproses…' : 'Ya, kerusakan sama'}
          </button>
          <button
            disabled={busy || pendingAction === 'support'}
            style={{ ...secondaryDisputeBtn, flex: 1 }}
            onClick={onDispute}
          >
            Tidak, kerusakan beda
          </button>
        </div>
        {error && (
          <p role="alert" style={{ color: '#A61C24', fontSize: 13 }}>
            {error}
          </p>
        )}
        {pendingAction && !busy && (
          <p role="status">
            Unggahan belum lengkap. Tekan pilihan yang sama untuk melanjutkan. Jangan tutup halaman
            ini.
          </p>
        )}
        <p
          style={{
            fontSize: 11.5,
            color: 'var(--color-ink-soft)',
            marginTop: 10,
            marginBottom: 0,
            lineHeight: 1.4,
          }}
        >
          Kalau kamu pilih "kerusakan beda", laporanmu akan diperiksa dulu oleh admin sebelum tampil
          di daftar laporan publik.
        </p>
      </div>
    </div>
  );
}

const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(25,27,31,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 2000,
  overflowY: 'auto',
};

const panel = {
  width: '100%',
  maxWidth: 720,
  background: 'var(--color-surface)',
  borderRadius: 16,
  padding: '24px 24px 28px',
  boxShadow: 'var(--shadow-card)',
  position: 'relative',
  maxHeight: 'calc(100dvh - 32px)',
  overflowY: 'auto',
};

const mediaRow = {
  display: 'flex',
  gap: 16,
  marginTop: 14,
  flexWrap: 'wrap',
};

const mediaCol = {
  flex: '1 1 260px',
  minWidth: 0,
};

const closeBtn = {
  position: 'absolute',
  top: 14,
  right: 14,
  width: 28,
  height: 28,
  borderRadius: '50%',
  border: 'none',
  background: 'var(--color-bg)',
  color: 'var(--color-ink-soft)',
  fontSize: 14,
  cursor: 'pointer',
};

const photoWrap = {
  position: 'relative',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
  background: '#000',
  aspectRatio: '16 / 10',
};

const photoImg = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };

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
  cursor: 'pointer',
};

const dotsRow = {
  position: 'absolute',
  bottom: 8,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  gap: 5,
};

const dot = { width: 6, height: 6, borderRadius: '50%', background: '#fff' };

const statGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 12,
  margin: '16px 0 0',
  padding: '14px',
  background: 'var(--color-bg)',
  borderRadius: 'var(--radius-md)',
};

const statLabel = {
  fontSize: 11,
  color: 'var(--color-ink-soft)',
  margin: 0,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};
const statValue = { fontSize: 18, fontWeight: 700, margin: '2px 0 0' };

const primaryBtn = {
  padding: '13px 16px',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  background: '#A61C24',
  color: '#fff',
  fontWeight: 700,
  fontSize: 15,
};

const secondaryDisputeBtn = {
  padding: '13px 16px',
  borderRadius: 'var(--radius-md)',
  border: '1.5px solid #A61C24',
  background: '#fff',
  color: '#A61C24',
  fontWeight: 700,
  fontSize: 15,
};
