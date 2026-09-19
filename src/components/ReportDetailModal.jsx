import { useEffect, useState } from 'react';
import { damageTypeDisplayLabel, severityDisplayLabel } from '../ai/hazardScore.js';
import { listComments, listSupporters, getReportPhotos } from '../lib/reports.js';
import { reverseGeocode } from '../lib/geolocation.js';
import ZoomableImage from './ZoomableImage.jsx';

const AVATAR_COLORS = ['#E8A93B', '#E0561F', '#191B1F', '#24506F'];

const STATUS_META = {
  open: { label: 'Menunggu Verifikasi', bg: '#FFF3CD', color: '#8A6D00' },
  accepted: { label: 'Diterima', bg: '#E7F1FF', color: '#1c5dcf' },
  in_progress: { label: 'Diproses', bg: '#E7F1FF', color: '#1c5dcf' },
  resolved: { label: 'Selesai', bg: '#E6F8EC', color: '#1c8a4b' },
  rejected: { label: 'Ditolak', bg: '#FDECEE', color: '#A61C24' },
};

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default function ReportDetailModal({ report, onClose }) {
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [supporters, setSupporters] = useState([]);
  const [address, setAddress] = useState(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [afterPhotoUrl, setAfterPhotoUrl] = useState(null);

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    if (!report?.id) return;
    setCommentsLoading(true);
    listComments(report.id)
      .then(setComments)
      .catch((err) => console.warn('[comments]', err.message))
      .finally(() => setCommentsLoading(false));

    listSupporters(report.id)
      .then(setSupporters)
      .catch((err) => console.warn('[supporters]', err.message));

    setAfterPhotoUrl(null);
    getReportPhotos(report.id)
      .then((photos) => {
        const resolutionPhotos = photos.filter((p) => p.photo_type === 'resolution');
        const latest = resolutionPhotos[resolutionPhotos.length - 1];
        setAfterPhotoUrl(latest?.url ?? null);
      })
      .catch((err) => console.warn('[report-photos]', err.message));

    if (typeof report.lat === 'number' && typeof report.lng === 'number') {
      setAddress(null);
      setAddressLoading(true);
      reverseGeocode(report.lat, report.lng)
        .then(setAddress)
        .catch((err) => {
          console.warn('[geocode]', err.message);
          setAddress(`${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}`);
        })
        .finally(() => setAddressLoading(false));
    }
  }, [report?.id]);

  if (!report) return null;
  const meta = STATUS_META[report.status] ?? STATUS_META.open;
  const severityLabel = report.severity ? severityDisplayLabel(report.severity) : null;
  const locationText = addressLoading ? 'Mendeteksi lokasi…' : address || 'Lokasi tidak tersedia';

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} className="rw-modal-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={idText}>#{String(report.id).slice(0, 8).toUpperCase()}</span>
            <span style={{ ...statusPill, background: meta.bg, color: meta.color }}>
              {meta.label}
            </span>
          </div>
          <button type="button" onClick={onClose} style={closeBtn} aria-label="Tutup">
            ✕
          </button>
        </div>

        <h2 style={titleStyle} className="rw-modal-title">
          {locationText}
        </h2>
        <div style={dateRow}>
          <CalendarIcon />
          Dilaporkan pada {formatDate(report.created_at)}
        </div>

        <style>{modalResponsiveCss}</style>
        <div style={contentGrid} className="rw-modal-grid">
          {/* Kiri: Foto + Deskripsi */}
          <div>
            <div style={photoGrid} className="rw-modal-photo-grid">
              <div>
                <div style={photoLabel}>Foto Laporan</div>
                <ZoomableImage
                  src={report.imageUrl || 'https://placehold.co/400x260?text=Belum+ada+foto'}
                  alt="Foto laporan"
                  style={photoStyle}
                />
              </div>
              <div>
                <div style={photoLabel}>Sesudah Perbaikan</div>
                {afterPhotoUrl ? (
                  <ZoomableImage
                    src={afterPhotoUrl}
                    alt="Foto sesudah perbaikan"
                    style={photoStyle}
                  />
                ) : report.status === 'resolved' ? (
                  <div style={{ ...photoStyle, ...placeholderBox }}>
                    Foto sesudah belum tersedia di sistem
                  </div>
                ) : (
                  <div style={{ ...photoStyle, ...placeholderBox }}>Menunggu proses perbaikan</div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={sectionLabel}>
                <NoteIcon /> Deskripsi
              </div>
              <div style={descBox}>
                {report.note?.trim() ? report.note : 'Tidak ada catatan tambahan.'}
              </div>
            </div>

            {(report.damage_type || severityLabel) && (
              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                {report.damage_type && (
                  <span style={infoPill}>{damageTypeDisplayLabel(report.damage_type)}</span>
                )}
                {severityLabel && <span style={infoPill}>{severityLabel}</span>}
                {typeof report.hazard_score === 'number' && (
                  <span style={infoPill}>Skor {Math.round(report.hazard_score)}%</span>
                )}
              </div>
            )}
          </div>

          {/* Kanan: Status timeline */}
          <div>
            <div style={statusCard}>
              <div style={sectionLabel}>Status Laporan</div>
              <TimelineStep label="Laporan Dikirim" date={formatDate(report.created_at)} done />

              {report.status === 'rejected' ? (
                <TimelineStep
                  label="Ditolak"
                  date={formatDate(report.rejected_at ?? report.updated_at)}
                  done
                  danger
                  note={report.rejection_reason || 'Tidak ada alasan yang dicantumkan.'}
                  isLast
                />
              ) : (
                <>
                  <TimelineStep
                    label="Diverifikasi"
                    date={report.status !== 'open' ? formatDate(report.accepted_at) : null}
                    done={report.status !== 'open'}
                  />
                  <TimelineStep
                    label="Sedang Diproses"
                    date={
                      ['in_progress', 'resolved'].includes(report.status)
                        ? formatDate(report.started_at)
                        : null
                    }
                    done={['in_progress', 'resolved'].includes(report.status)}
                  />
                  <TimelineStep
                    label="Selesai"
                    date={report.status === 'resolved' ? formatDate(report.resolved_at) : null}
                    done={report.status === 'resolved'}
                    isLast
                  />
                </>
              )}
            </div>

            <div style={{ ...supportCard, marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <HeartIcon />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#A61C24' }}>
                  Dukungan Warga
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ display: 'flex' }}>
                  {supporters.slice(0, 3).map((s, i) => (
                    <div key={s.id} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                      {s.avatar_url ? (
                        <img
                          src={s.avatar_url}
                          alt={s.username || 'Pendukung'}
                          style={supporterAvatarImg}
                        />
                      ) : (
                        <div style={{ ...supporterAvatarImg, ...supporterAvatarFallback }}>
                          {(s.username?.[0] || 'A').toUpperCase()}
                        </div>
                      )}
                    </div>
                  ))}
                  {supporters.length === 0 && (
                    <div style={{ ...supporterAvatarImg, ...supporterAvatarFallback }}>-</div>
                  )}
                </div>
                <span style={{ fontSize: 13, color: '#A61C24', fontWeight: 600 }}>
                  {supporters.length > 3
                    ? `+${supporters.length - 3} lainnya`
                    : `${report.support_count ?? supporters.length ?? 0} orang mendukung`}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <ChatIcon />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#A61C24' }}>
                  Komentar Terbaru
                </span>
              </div>

              {commentsLoading && (
                <p style={{ fontSize: 12, color: '#c98a90', margin: 0 }}>Memuat komentar…</p>
              )}
              {!commentsLoading && comments.length === 0 && (
                <p style={{ fontSize: 12, color: '#c98a90', margin: 0 }}>Belum ada komentar.</p>
              )}
              {!commentsLoading &&
                comments
                  .slice(-5)
                  .reverse()
                  .map((c, i) => {
                    const name = c.profile?.username?.trim() || 'Anonim';
                    const initial = name[0]?.toUpperCase() ?? 'A';
                    const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                    return (
                      <div key={c.id} style={commentRow}>
                        {c.profile?.avatar_url ? (
                          <img src={c.profile.avatar_url} alt={name} style={commentAvatarImg} />
                        ) : (
                          <span style={{ ...commentAvatar, backgroundColor: color }}>
                            {initial}
                          </span>
                        )}
                        <span style={commentText}>{c.content}</span>
                      </div>
                    );
                  })}

              {!commentsLoading && comments.length > 5 && (
                <div style={{ fontSize: 12, fontWeight: 700, color: '#A61C24', marginTop: 4 }}>
                  +{comments.length - 5} lainnya
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineStep({ label, date, done, isLast, danger, note }) {
  const activeColor = danger ? '#A61C24' : '#1c8a4b';
  return (
    <div style={{ display: 'flex', gap: 10, position: 'relative', paddingBottom: isLast ? 0 : 18 }}>
      {!isLast && (
        <div
          style={{
            position: 'absolute',
            left: 9,
            top: 20,
            bottom: 0,
            width: 2,
            background: done ? activeColor : '#e9ecef',
          }}
        />
      )}
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: done ? activeColor : '#e9ecef',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        {done ? (danger ? '✕' : '✓') : ''}
      </div>
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: done ? (danger ? '#A61C24' : '#212529') : '#adb5bd',
          }}
        >
          {label}
        </div>
        {date && <div style={{ fontSize: 11, color: '#adb5bd' }}>{date}</div>}
        {note && (
          <div
            style={{
              fontSize: 12,
              color: '#A61C24',
              background: '#FDECEE',
              borderRadius: 8,
              padding: '6px 10px',
              marginTop: 6,
              maxWidth: 220,
            }}
          >
            {note}
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#868e96"
      strokeWidth="2"
      style={{ flexShrink: 0 }}
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" strokeLinecap="round" />
      <line x1="16" y1="3" x2="16" y2="7" strokeLinecap="round" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#A61C24"
      strokeWidth="2"
      style={{ flexShrink: 0 }}
    >
      <path d="M9 3h6l3 3v15H6V3z" />
      <line x1="9" y1="9" x2="15" y2="9" />
      <line x1="9" y1="13" x2="15" y2="13" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="#A61C24"
      style={{ flexShrink: 0, display: 'block' }}
    >
      <path d="M12 21s-7.5-4.9-10.1-9.3C.3 8.8 1.6 5.3 4.9 4.4c2-.5 4 .3 5.1 2 1.1-1.7 3.1-2.5 5.1-2 3.3.9 4.6 4.4 3 7.3C19.5 16.1 12 21 12 21z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#A61C24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, display: 'block' }}
    >
      <path d="M21 12c0 4.4-4 8-9 8-1.3 0-2.6-.2-3.7-.7L3 21l1.3-4.1C3.5 15.6 3 13.9 3 12c0-4.4 4-8 9-8s9 3.6 9 8z" />
    </svg>
  );
}

const modalResponsiveCss = `
  @media (max-width: 720px) {
    .rw-modal-panel {
      padding: 20px !important;
      border-radius: 14px !important;
      max-height: 92vh !important;
    }
    .rw-modal-grid {
      grid-template-columns: 1fr !important;
      gap: 20px !important;
    }
    .rw-modal-photo-grid {
      grid-template-columns: 1fr !important;
    }
    .rw-modal-title {
      font-size: 19px !important;
    }
  }
`;

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  zIndex: 2000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 12,
};

const panelStyle = {
  background: '#fff',
  borderRadius: 16,
  padding: '28px 32px',
  width: '100%',
  maxWidth: 900,
  maxHeight: '90vh',
  overflowY: 'auto',
};

const headerRow = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 16,
};
const idText = { fontSize: 18, fontWeight: 800, color: '#212529' };
const statusPill = { fontSize: 12.5, fontWeight: 700, padding: '5px 14px', borderRadius: 999 };
const closeBtn = {
  border: 'none',
  background: '#f1f3f5',
  width: 36,
  height: 36,
  borderRadius: '50%',
  cursor: 'pointer',
  fontSize: 14,
  color: '#495057',
  flexShrink: 0,
};
const titleStyle = { fontSize: 24, fontWeight: 700, margin: '0 0 8px' };
const dateRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 13,
  color: '#868e96',
  marginBottom: 20,
};

const contentGrid = { display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 };
const photoGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 };
const photoLabel = { fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#495057' };
const photoStyle = {
  width: '100%',
  height: 180,
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

const sectionLabel = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 14,
  fontWeight: 700,
  color: '#212529',
  marginBottom: 10,
};
const descBox = {
  background: '#f8f9fa',
  borderRadius: 10,
  padding: '12px 14px',
  fontSize: 13.5,
  color: '#495057',
  lineHeight: 1.5,
};
const infoPill = {
  fontSize: 12,
  fontWeight: 600,
  color: '#A61C24',
  background: '#FDECEE',
  padding: '5px 12px',
  borderRadius: 999,
};

const statusCard = {
  background: '#fff',
  border: '1px solid #f1f3f5',
  borderRadius: 12,
  padding: 16,
};
const supportCard = {
  background: '#FDECEE',
  border: '1px solid #f6c9ce',
  borderRadius: 12,
  padding: 16,
};

const commentRow = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 };
const commentAvatar = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  color: '#ffffff',
  fontSize: 10,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
const commentAvatarImg = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  objectFit: 'cover',
  flexShrink: 0,
};
const commentText = { fontSize: 12, color: '#A61C24', fontWeight: 500 };

const supporterAvatarImg = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  objectFit: 'cover',
  border: '2px solid #FDECEE',
  display: 'block',
};
const supporterAvatarFallback = {
  background: '#e08e8e',
  color: '#fff',
  fontSize: 11,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
