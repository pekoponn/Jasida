import { useMemo, useState } from 'react';
import CameraCapture from '../features/report-upload/CameraCapture.jsx';
import DuplicateModal from '../features/duplicate-check/DuplicateModal.jsx';
import SeverityBadge from '../components/SeverityBadge.jsx';
import { detectDamage, detectDamageMock } from '../ai/yolo.js';
import { embedImage, embedImageMock } from '../ai/clip.js';
import { computeHazardScore, severityDisplayLabel, damageTypeDisplayLabel } from '../ai/hazardScore.js';
import { pickBestDuplicate } from '../ai/duplicateScore.js';
import { findSimilarReports, createReport, uploadReportImage, supportReport } from '../lib/reports.js';
import { reverseGeocode } from '../lib/geolocation.js';
import MapPreview from '../components/MapPreview.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { isWithinSidoarjo } from '../lib/geofence.js';
import { useNavigate } from 'react-router-dom';

export default function ReportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [note, setNote] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [step, setStep] = useState('idle');
  const [error, setError] = useState(null);
  const [detections, setDetections] = useState([]);
  const [imageDims, setImageDims] = useState(null); // { width, height }
  const [embedding, setEmbedding] = useState(null);
  const [position, setPosition] = useState(null);
  const [capturedAt, setCapturedAt] = useState(null);
  const [address, setAddress] = useState(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [hazard, setHazard] = useState(null);
  const [duplicate, setDuplicate] = useState(null);
  const [usingMockModel, setUsingMockModel] = useState(false);

  const hazardVisible = useMemo(() => step !== 'idle' && step !== 'analyzing' && hazard, [step, hazard]);

  async function handlePhotoCaptured({ file: selectedFile, position: gps, capturedAt }) {
    setError(null);
    setDuplicate(null);

    if (gps && !isWithinSidoarjo(gps.lat, gps.lng)) {
      setError('Laporan hanya bisa dikirim untuk lokasi di dalam wilayah Kabupaten Sidoarjo. Foto ini terdeteksi di luar area tersebut.');
      return;
    }

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setPosition(gps);
    setCapturedAt(capturedAt);
    setAddress(null);
    setStep('analyzing');

    if (gps) {
      setAddressLoading(true);
      reverseGeocode(gps.lat, gps.lng)
        .then(setAddress)
        .catch((err) => {
          console.warn('[geocode]', err.message);
          setAddress(`${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`);
        })
        .finally(() => setAddressLoading(false));
    }

    try {
      const { detections: dets, imageWidth, imageHeight } = await runDetection(selectedFile);
      const emb = await runEmbedding(selectedFile);

      setDetections(dets);
      setImageDims({ width: imageWidth, height: imageHeight });
      setEmbedding(emb);

      const hazardResult = computeHazardScore({ detections: dets, imageWidth, imageHeight });
      setHazard(hazardResult);
      setStep('analyzed');

      if (gps) {
        await checkDuplicates({ gps, damageType: hazardResult.dominant?.damage_type ?? null, embedding: emb });
      }
    } catch (err) {
      console.error(err);
      setError('Gagal menganalisis foto. Coba lagi.');
      setStep('idle');
    }
  }

  async function runDetection(selectedFile) {
    try {
      const result = await detectDamage(selectedFile);
      setUsingMockModel(false);
      return result;
    } catch (err) {
      console.warn('[yolo] fallback ke mock model:', err.message);
      setUsingMockModel(true);
      return detectDamageMock(selectedFile);
    }
  }

  async function runEmbedding(selectedFile) {
    try {
      return await embedImage(selectedFile);
    } catch (err) {
      console.warn('[clip] fallback ke mock embedding:', err.message);
      return embedImageMock(selectedFile);
    }
  }

  async function checkDuplicates({ gps, damageType, embedding: emb }) {
    setStep('checking-duplicate');
    try {
      const candidates = await findSimilarReports({ lat: gps.lat, lng: gps.lng, damageType, embedding: emb });
      const best = pickBestDuplicate(candidates);
      if (best && best.action !== 'new_report') {
        setDuplicate(best);
      }
      setStep('analyzed');
    } catch (err) {
      console.warn('[duplicate-check] dilewati:', err.message);
      setStep('analyzed');
    }
  }

  async function handleSubmitNewReport() {
    setStep('submitting');
    setError(null);
    try {
      const report = await createReport({
        damageType: hazard.dominant?.damage_type ?? 'other_corruption',
        confidence: hazard.dominant?.confidence ?? 0,
        hazardScore: hazard.total,
        severity: hazard.severity,
        lat: position?.lat ?? 0,
        lng: position?.lng ?? 0,
        embedding,
        capturedAt,
        note
      });
      await uploadReportImage(file, report.id);
      setStep('done');
    } catch (err) {
      console.error(err);
      setError('Gagal mengirim laporan. Periksa koneksi Supabase kamu (lihat .env).');
      setStep('analyzed');
    }
  }

  async function handleSupportExisting(candidate) {
  try {
    await supportReport(candidate.id, file);
  } catch (err) {
    console.warn('[support]', err.message);
  }
  setDuplicate(null);
  setStep('done');
}

  function reset() {
    setFile(null);
    setPreviewUrl(null);
    setNote('');
    setStep('idle');
    setDetections([]);
    setImageDims(null);
    setEmbedding(null);
    setPosition(null);
    setCapturedAt(null);
    setHazard(null);
    setDuplicate(null);
    setError(null);
  }

  if (!user) {
    return (
      <section style={{ textAlign: 'center', paddingTop: 48 }}>
        <div style={{ fontSize: 40 }} aria-hidden="true">🔒</div>
        <h2 className="display" style={{ fontSize: 22, marginTop: 12 }}>Masuk untuk melapor</h2>
        <p style={{ color: 'var(--color-ink-soft)' }}>
          Kamu perlu masuk atau daftar akun dulu supaya laporanmu bisa ditandai atas nama kamu
          dan bisa dikonfirmasi/dikomentari warga lain.
        </p>
        <button style={primaryBtn} onClick={() => navigate('/login')}>Masuk / Daftar</button>
      </section>
    );
  }

  if (step === 'done') {
    return (
      <section style={{ textAlign: 'center', paddingTop: 48 }}>
        <div style={{ fontSize: 40 }} aria-hidden="true">✅</div>
        <h2 className="display" style={{ fontSize: 22, marginTop: 12 }}>Laporan terkirim</h2>
        <p style={{ color: 'var(--color-ink-soft)' }}>Terima kasih sudah membantu memantau infrastruktur kota.</p>
        <button style={primaryBtn} onClick={reset}>Lapor kerusakan lain</button>
      </section>
    );
  }

  return (
    <section>
      <h1 className="display" style={{ fontSize: 24, marginBottom: 4 }}>Lapor kondisi jalan</h1>
      <p style={{ color: 'var(--color-ink-soft)', marginTop: 0, fontSize: 14 }}>
        Ambil foto langsung dari kamera, AI akan mendeteksi lubang/retak/sampah pada jalan dan memeriksa laporan serupa di sekitar lokasimu.
      </p>

      <div style={{ marginTop: 20, position: 'relative' }}>
        {previewUrl && step !== 'idle' ? (
          <div style={{ position: 'relative' }}>
            <img
              src={previewUrl}
              alt="Foto kondisi jalan yang baru diambil"
              style={{ width: '100%', borderRadius: 'var(--radius-lg)', display: 'block' }}
            />
            {imageDims && detections.length > 0 && (
              <DetectionOverlay detections={detections} imageWidth={imageDims.width} imageHeight={imageDims.height} />
            )}
          </div>
        ) : (
          <CameraCapture onCapture={handlePhotoCaptured} disabled={step === 'analyzing' || step === 'submitting'} />
        )}
      </div>

      {previewUrl && step !== 'idle' && (
        <>
          <p style={locationLine}>
            📍{' '}
            {addressLoading ? 'Mendeteksi lokasi…' : address || 'Lokasi tidak tersedia'}
          </p>
          {position && !duplicate && <MapPreview lat={position.lat} lng={position.lng} />}
        </>
      )}

      {step === 'analyzing' && <StatusLine text="Menganalisis foto dengan AI…" />}
      {step === 'checking-duplicate' && <StatusLine text="Memeriksa laporan serupa di sekitar…" />}

      {usingMockModel && step !== 'idle' && (
        <p style={noteStyle}>
          ⚠️ Model AI belum ditemukan di <code>/public/models</code> — hasil di bawah ini masih data contoh (mock) untuk keperluan demo alur.
        </p>
      )}

      {error && <p style={errorStyle}>{error}</p>}

            {hazardVisible && (
        <div style={resultCard}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            {hazard.dominant ? damageTypeDisplayLabel(hazard.dominant.damage_type) : 'Tidak terdeteksi kerusakan'}
          </div>

          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <SeverityBadge severity={hazard.severity} score={hazard.total} />
          </div>

          {!position && (
            <p style={{ fontSize: 12, color: 'var(--color-ink-soft)', marginTop: 8 }}>
              📍 Lokasi tidak tersedia — izinkan akses GPS agar laporan lebih akurat.
            </p>
          )}

          {step === 'analyzed' && !duplicate && (
            <>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tambahkan catatan (opsional) — misal: 'sudah 2 minggu, banyak motor jatuh di sini'"
                rows={3}
                style={noteInput}
              />
              <button style={{ ...primaryBtn, width: '100%', marginTop: 8 }} onClick={handleSubmitNewReport}>
                Kirim laporan
              </button>
            </>
          )}
          {step === 'submitting' && <StatusLine text="Mengirim laporan…" />}
        </div>
      )}

      <DuplicateModal
        candidate={duplicate}
        position={position}
        onSupport={handleSupportExisting}
        onClose={() => setDuplicate(null)}
      />
    </section>
  );
}

/** Menggambar kotak deteksi (bbox) di atas foto pakai SVG overlay. */
function DetectionOverlay({ detections, imageWidth, imageHeight }) {
  return (
    <svg
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      {detections.map((d, i) => {
        const [x, y, w, h] = d.bbox;
        return (
          <g key={`${d.damage_type}-${i}`}>
            <rect
              x={x} y={y} width={w} height={h}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth={Math.max(imageWidth * 0.004, 2)}
              rx={4}
            />
            <text
              x={x} y={Math.max(y - 6, 12)}
              fontSize={Math.max(imageWidth * 0.02, 14)}
              fill="var(--color-primary)"
              style={{ fontWeight: 700 }}
            >
              {damageTypeDisplayLabel(d.damage_type)} {Math.round(d.confidence * 100)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function StatusLine({ text }) {
  return (
    <p style={{ fontSize: 14, color: 'var(--color-primary)', fontWeight: 600, marginTop: 12 }}>
      {text}
    </p>
  );
}

const resultCard = { marginTop: 16, padding: 16, background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)' };
const primaryBtn = { padding: '13px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-primary)', color: 'var(--color-primary-ink)', fontWeight: 700, fontSize: 15, marginTop: 20 };
const locationLine = { fontSize: 13, color: 'var(--color-ink-soft)', marginTop: 8, marginBottom: 0 };
const noteInput = { width: '100%', marginTop: 16, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' };
const errorStyle = { color: 'var(--sev-emergency)', fontSize: 14, marginTop: 12, fontWeight: 500 };
const noteStyle = { fontSize: 12.5, color: '#8a5a12', background: '#FBF0DA', border: '1px solid #F0D9A8', borderRadius: 'var(--radius-sm)', padding: '8px 10px', marginTop: 12 };