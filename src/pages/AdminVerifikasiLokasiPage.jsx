import { useEffect, useRef, useState } from 'react';
import { fetchLocationReviews, reviewLocation } from '../lib/reports.js';
import { damageTypeDisplayLabel } from '../ai/hazardScore.js';
import ZoomableImage from '../components/ZoomableImage.jsx';
import ReportEvidenceGallery from '../components/ReportEvidenceGallery.jsx';

const SOURCE_LABEL = {
  camera_gps: 'Kamera (GPS langsung)',
  device_gps: 'GPS perangkat',
  exif: 'EXIF foto',
  manual: 'Pin manual',
};

const FLAG_LABEL = {
  far_from_road: 'Pin jauh dari jalan',
  road_unknown: 'Pemeriksaan jalan tidak tersedia',
  photo_reused: 'Foto sangat mirip dengan laporan di lokasi lain',
};

const DEFAULT_REJECT_REASON =
  'Lokasi pada peta tidak sesuai dengan foto. Silakan kirim ulang dengan lokasi yang benar.';

export default function AdminVerifikasiLokasiPage() {
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
      setItems(await fetchLocationReviews());
    } catch (err) {
      console.error(err);
      setError('Gagal memuat data verifikasi lokasi: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReview(id, decision, reason) {
    setBusyId(id);
    try {
      await reviewLocation(id, decision, reason);
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (err) {
      alert('Gagal menyimpan verifikasi: ' + err.message);
    } finally {
      setBusyId(null);
    }
  }

  const pendingCount = items.filter((i) => i.location_status === 'pending').length;

  return (
    <section>
      <h1 className="display" style={{ fontSize: 24, marginBottom: 4 }}>
        Verifikasi Lokasi
      </h1>
      <p style={{ color: '#868e96', marginTop: 0, fontSize: 14 }}>
        Periksa laporan yang lokasinya dipilih manual lewat pin. Bandingkan foto laporan dan foto
        konteks dengan peta satelit atau Street View.
      </p>

      {!loading && items.length > 0 && (
        <p style={{ fontSize: 13, color: '#495057' }}>
          <strong>{pendingCount}</strong> ditahan (belum tampil publik) ·{' '}
          <strong>{items.length - pendingCount}</strong> sudah tampil, menunggu pengecekan
        </p>
      )}

      {error && <p style={{ color: '#e03131', marginTop: 12 }}>{error}</p>}
      {loading && <p style={{ marginTop: 12 }}>Memuat…</p>}

      {!loading && items.length === 0 && (
        <div style={emptyState}>Tidak ada laporan yang perlu diverifikasi lokasinya.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
        {items.map((item) => (
          <ReviewCard
            key={item.id}
            item={item}
            busy={busyId === item.id}
            onReview={(decision, reason) => handleReview(item.id, decision, reason)}
          />
        ))}
      </div>
    </section>
  );
}

function ReviewCard({ item, busy, onReview }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(DEFAULT_REJECT_REASON);
  const held = item.location_status === 'pending';
  const flags = item.location_flags ?? [];
  const hasLatLng = Number.isFinite(item.lat) && Number.isFinite(item.lng);

  const checks = [];
  if (typeof item.road_distance_m === 'number' && !flags.includes('far_from_road')) {
    checks.push({ ok: true, text: `Dekat jalan (${item.road_distance_m} m)` });
  }
  flags
    .filter((f) => f !== 'no_context_photo')
    .forEach((f) => checks.push({ ok: false, text: FLAG_LABEL[f] ?? f }));
  checks.push(
    item.contextPhoto
      ? { ok: true, text: 'Foto konteks tersedia' }
      : { ok: false, text: 'Tidak ada foto konteks' }
  );

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
          <span style={infoPill}>
            {SOURCE_LABEL[item.location_source] ?? 'Sumber tidak diketahui'}
          </span>
          <span style={held ? heldPill : visiblePill}>
            {held ? 'Ditahan' : 'Sudah tampil publik'}
          </span>
        </div>
      </div>

      <div style={grid}>
        <div>
          <div style={label}>Lokasi pin</div>
          {hasLatLng ? (
            <>
              <LocationMap lat={item.lat} lng={item.lng} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <a
                  href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${item.lat},${item.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  style={linkBtn}
                >
                  Buka Street View
                </a>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  style={linkBtn}
                >
                  Buka di Google Maps
                </a>
              </div>
              {item.address && (
                <div style={{ fontSize: 12, color: '#868e96', marginTop: 6 }}>{item.address}</div>
              )}
            </>
          ) : (
            <div style={placeholderBox}>Koordinat tidak tersedia.</div>
          )}
        </div>

        <div>
          <div style={label}>Foto laporan</div>
          <ZoomableImage
            src={item.imageUrl || 'https://placehold.co/400x260?text=Tidak+ada+foto'}
            alt="Foto laporan"
            style={photoStyle}
          />
          <ReportEvidenceGallery reportId={item.id} />

          <div style={{ ...label, marginTop: 14 }}>Foto konteks</div>
          {item.contextPhoto ? (
            <ZoomableImage src={item.contextPhoto.url} alt="Foto konteks" style={photoStyle} />
          ) : (
            <div style={{ ...photoStyle, ...placeholderBox }}>
              Pelapor tidak menyertakan foto konteks.
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 12.5, color: '#495057' }}>
            {item.damage_type && <div>{damageTypeDisplayLabel(item.damage_type)}</div>}
            {item.note && <div style={{ marginTop: 4, fontStyle: 'italic' }}>"{item.note}"</div>}
          </div>
        </div>
      </div>

      <ul style={checkList}>
        {checks.map((c) => (
          <li key={c.text} style={{ color: c.ok ? '#2b8a3e' : '#c2410c' }}>
            {c.ok ? '✓' : '⚠'} {c.text}
          </li>
        ))}
      </ul>

      {!rejecting ? (
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button
            style={{ ...actionBtn, background: '#2f9e44' }}
            disabled={busy}
            onClick={() => onReview('verify')}
          >
            Lokasi Sesuai
          </button>
          <button
            style={{ ...actionBtn, background: '#e03131' }}
            disabled={busy}
            onClick={() => setRejecting(true)}
          >
            Lokasi Tidak Sesuai
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>
            Alasan penolakan (ditampilkan ke pelapor)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              style={textarea}
            />
          </label>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button style={secondaryBtn} disabled={busy} onClick={() => setRejecting(false)}>
              Batal
            </button>
            <button
              style={{ ...actionBtn, background: '#e03131' }}
              disabled={busy || !reason.trim()}
              onClick={() => onReview('reject', reason.trim())}
            >
              Tolak Laporan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LocationMap({ lat, lng }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!window.L || !ref.current) return undefined;
    const L = window.L;
    const map = L.map(ref.current, { scrollWheelZoom: false }).setView([lat, lng], 18);

    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Tiles &copy; Esri' }
    ).addTo(map);
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    });
    L.control.layers({ Satelit: satellite, Peta: osm }, null, { position: 'topright' }).addTo(map);

    L.circleMarker([lat, lng], {
      radius: 9,
      color: '#ffffff',
      weight: 3,
      fillColor: '#A61C24',
      fillOpacity: 1,
    }).addTo(map);

    const t = setTimeout(() => map.invalidateSize(), 100);
    return () => {
      clearTimeout(t);
      map.remove();
    };
  }, [lat, lng]);

  return (
    <div ref={ref} style={{ width: '100%', height: 260, borderRadius: 10, overflow: 'hidden' }} />
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
const heldPill = { ...infoPill, color: '#8A6D00', background: '#FFF3CD' };
const visiblePill = { ...infoPill, color: '#1c5dcf', background: '#E7F1FF' };

const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 20,
};

const label = { fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#495057' };
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
  minHeight: 80,
  borderRadius: 10,
};

const linkBtn = {
  padding: '7px 12px',
  borderRadius: 8,
  border: '1px solid #dee2e6',
  background: '#fff',
  color: '#A61C24',
  fontSize: 12.5,
  fontWeight: 700,
  textDecoration: 'none',
};

const checkList = {
  listStyle: 'none',
  margin: '16px 0 0',
  padding: '12px 14px',
  background: '#f8f9fa',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const actionBtn = {
  flex: 1,
  minWidth: 160,
  padding: '11px 16px',
  borderRadius: 8,
  border: 'none',
  color: '#fff',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryBtn = {
  padding: '11px 16px',
  borderRadius: 8,
  border: '1px solid #dee2e6',
  background: '#fff',
  color: '#495057',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const textarea = {
  display: 'block',
  width: '100%',
  marginTop: 6,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #dee2e6',
  fontSize: 14,
  fontFamily: 'inherit',
  resize: 'vertical',
  boxSizing: 'border-box',
};
