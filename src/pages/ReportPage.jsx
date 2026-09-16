import { useEffect, useMemo, useRef, useState } from 'react';
import { prepareUploadPhoto } from '../lib/imageUpload.js';
import CameraCapture from '../features/report-upload/CameraCapture.jsx';
import DuplicateModal from '../features/duplicate-check/DuplicateModal.jsx';
import SeverityBadge from '../components/SeverityBadge.jsx';
import { detectDamage } from '../ai/yolo.js';
import { embedImage } from '../ai/clip.js';
import { computeHazardScore, damageTypeDisplayLabel } from '../ai/hazardScore.js';
import { pickBestDuplicate } from '../ai/duplicateScore.js';
import { findSimilarReports, createReport, uploadReportImage, addReporter } from '../lib/reports.js';
import { reverseGeocode, getCurrentPosition } from '../lib/geolocation.js';
import MapPreview from '../components/MapPreview.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { validateReportLocation } from '../lib/reportLocation.js';
import { useNavigate } from 'react-router-dom';
import { useIsMobileDevice } from '../lib/useIsMobileDevice.js';

export default function ReportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobileDevice = useIsMobileDevice();
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
  const [duplicateUnavailable, setDuplicateUnavailable] = useState(false);
  const [duplicateCheckFailed, setDuplicateCheckFailed] = useState(false);
  const [locatingSelf, setLocatingSelf] = useState(false);
  const [testingMode, setTestingMode] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const submitting = useRef(false);
  const pendingReport = useRef(null);
  const busy = cameraBusy || ['preparing', 'analyzing', 'checking-duplicate', 'submitting'].includes(step);

  function changeMode(testing) {
    if (busy) return;
    setTestingMode(testing);
    setError(position ? validateReportLocation(position, testing) : null);
    setDuplicate(null);
  }

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const hazardVisible = useMemo(() => step !== 'idle' && step !== 'analyzing' && hazard, [step, hazard]);

  async function handlePhotoCaptured({ file: selectedFile, position: gps, capturedAt }) {
    setCameraBusy(false);
    setError(null);
    setDuplicate(null);
    setDuplicateUnavailable(false);
    setDuplicateCheckFailed(false);
    setHazard(null);

    const locationError = gps && validateReportLocation(gps, testingMode);
    if (locationError) {
      setError(locationError);
      return;
    }

    setStep('preparing');
    let photo;
    try {
      photo = await prepareUploadPhoto(selectedFile);
    } catch (err) {
      setError(err.message);
      setStep('idle');
      return;
    }
    setFile(photo);
    setPreviewUrl(URL.createObjectURL(photo));
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
      const { detections: dets, imageWidth, imageHeight } = await detectDamage(photo);
      const emb = await runEmbedding(photo);

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
      setHazard(null);
      setError('Analisis AI gagal. Periksa koneksi, lalu coba lagi. Foto belum dapat dikirim.');
      setStep('idle');
    }
  }

  async function runEmbedding(selectedFile) {
    try {
      return await embedImage(selectedFile);
    } catch (err) {
      console.warn('[clip] pemeriksaan duplikat tidak tersedia:', err.message);
      setDuplicateUnavailable(true);
      return null;
    }
  }

  async function checkDuplicates({ gps, damageType, embedding: emb }) {
    setStep('checking-duplicate');
    setDuplicateCheckFailed(false);
    try {
      const candidates = await findSimilarReports({ lat: gps.lat, lng: gps.lng, damageType, embedding: emb });
      const best = pickBestDuplicate(candidates);
      if (best && best.action !== 'new_report') {
        setDuplicate(best);
      }
      setStep('analyzed');
    } catch (err) {
      console.warn('[duplicate-check] dilewati:', err.message);
      setDuplicateCheckFailed(true);
      setStep('analyzed');
    }
  }

  async function handleSubmitNewReport() {
    if (submitting.current || step !== 'analyzed' || !hazard || !file || locatingSelf || duplicate) return;
    const locationError = validateReportLocation(position, testingMode);
    if (locationError) {
      setError(locationError);
      return;
    }
    submitting.current = true;
    setStep('submitting');
    setError(null);
    try {
      const photo = await prepareUploadPhoto(file);
      const report = pendingReport.current ?? await createReport({
        damageType: hazard.dominant?.damage_type ?? 'other_corruption',
        confidence: hazard.dominant?.confidence ?? 0,
        hazardScore: hazard.total,
        severity: hazard.severity,
        lat: position.lat,
        lng: position.lng,
        embedding,
        capturedAt,
        note: testingMode ? `[UJI COBA LOMBA — BEBAS LOKASI] ${note}`.trim() : note,
        bboxAreaPct: computeBboxAreaPct(detections, imageDims?.width, imageDims?.height),
        address
      });
      pendingReport.current = report;
      await uploadReportImage(photo, report.id);
      pendingReport.current = null;
      setStep('done');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Gagal mengirim laporan. Periksa koneksi dan coba lagi.');
      setStep('analyzed');
    } finally {
      submitting.current = false;
    }
  }

  async function handleSupportExisting(candidate) {
    if (submitting.current) return;
    submitting.current = true;
    setStep('submitting');
    try {
      await addReporter(candidate.id);
    } catch (err) {
      console.warn('[add-reporter]', err.message);
      setError(err.message || 'Gagal menambahkan laporanmu. Coba lagi.');
      setStep('analyzed');
      return;
    } finally {
      submitting.current = false;
    }
    setDuplicate(null);
    setStep('done');
  }

  async function handleUseCurrentLocation() {
    if (busy || locatingSelf) return;
    setLocatingSelf(true);
    setError(null);
    setDuplicate(null);
    try {
        const gps = await getCurrentPosition();
        const locationError = validateReportLocation(gps, testingMode);
        if (locationError) {
          setPosition(null);
          setError(locationError);
          return;
        }
        setPosition(gps);
        setAddressLoading(true);
        reverseGeocode(gps.lat, gps.lng)
          .then(setAddress)
          .catch((err) => {
            console.warn('[geocode]', err.message);
            setAddress(`${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`);
          })
          .finally(() => setAddressLoading(false));
        if (hazard && step === 'analyzed') {
          await checkDuplicates({ gps, damageType: hazard.dominant?.damage_type, embedding });
        }
    } catch (err) {
        console.warn('[geolocation]', err.message);
        setError('Gagal mendeteksi lokasi saat ini. Izinkan akses GPS di browser.');
    } finally { setLocatingSelf(false); }
  }

  function reset() {
    pendingReport.current = null;
    setCameraBusy(false);
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
    setDuplicateUnavailable(false);
    setDuplicateCheckFailed(false);
    setDuplicate(null);
    setError(null);
  }

  if (!user) {
    return (
      <section style={{ textAlign: 'center', padding: isMobileDevice ? '48px 20px' : '100px 20px' }}>
        <svg
          width={isMobileDevice ? 56 : 72}
          height={isMobileDevice ? 56 : 72}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#c92a2a"
          strokeWidth="1.5"
          style={{ margin: '0 auto 20px', display: 'block' }}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="7" x2="12" y2="13" strokeLinecap="round" />
          <circle cx="12" cy="16.5" r="0.75" fill="#c92a2a" stroke="none" />
        </svg>
        <h2 style={{ fontSize: isMobileDevice ? 20 : 28, fontWeight: 700, margin: '0 0 12px' }}>
          Masuk Untuk Melapor
        </h2>
        <p style={{
          color: '#868e96',
          fontSize: isMobileDevice ? 13 : 16,
          maxWidth: 480,
          margin: '0 auto 24px',
          lineHeight: 1.5
        }}>
          Kamu perlu masuk atau daftar untuk membuat akun dulu supaya laporanmu bisa ditandai atas nama kamu dan bisa dilihat warga yang lain
        </p>
        <button
          onClick={() => navigate('/login')}
          style={{
            border: '1.5px solid #c92a2a',
            color: '#c92a2a',
            background: '#fff',
            padding: isMobileDevice ? '11px 28px' : '13px 36px',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: isMobileDevice ? 13 : 15,
            cursor: 'pointer'
          }}
        >
          Masuk Sekarang
        </button>
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
    <section className="rp-wrap" style={{ paddingBottom: isMobileDevice ? 90 : 24 }}>
      <style>{responsiveCss}</style>

      <h1 className="display rp-title" style={rpTitleStyle}>Buat Laporan Kerusakan Jalan</h1>
      <p className="rp-subtitle" style={rpSubtitleStyle}>
        Ambil foto kondisi jalan langsung dari kamera. AI akan mendeteksi lubang/retak dan memeriksa laporan serupa di sekitar lokasimu.
      </p>

      <div style={modeToggleRow}>
        <button
          type="button"
          disabled={busy || locatingSelf || !!pendingReport.current}
          aria-pressed={!testingMode}
          onClick={() => changeMode(false)}
          style={testingMode ? modeBtnInactive : modeBtnActive}
        >
          Laporan Real (Khusus Sidoarjo)
        </button>
        <button
          type="button"
          disabled={busy || locatingSelf || !!pendingReport.current}
          aria-pressed={testingMode}
          onClick={() => changeMode(true)}
          style={testingMode ? modeBtnActiveWarn : modeBtnInactive}
        >
          Mode Uji Coba (Bebas Lokasi)
        </button>
      </div>

      {testingMode && (
        <div style={testingBanner}>
          ⚠️ <strong>Mode Uji Coba aktif</strong> — laporan bisa dikirim dari lokasi mana saja untuk keperluan demo/testing.
          Di penggunaan nyata, Jasida difokuskan hanya untuk laporan kerusakan jalan di wilayah Kabupaten Sidoarjo.
        </div>
      )}

      <div className="rp-card" style={rpCardStyle}>
        <div className="rp-grid" style={rpGridStyle}>
          {/* KOLOM KIRI: FOTO */}
          <div className="rp-col">
            <SectionHeading icon={<CameraIcon />} title="Foto Kerusakan" subtitle="Ambil foto langsung dari kamera perangkat" />

            <div className="rp-photo-box" style={{ marginTop: 16, position: 'relative' }}>
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
                <CameraCapture onCapture={handlePhotoCaptured} onBusyChange={setCameraBusy} disabled={locatingSelf || ['preparing', 'analyzing', 'submitting'].includes(step)} />
              )}
            </div>

            {previewUrl && ['analyzed', 'idle'].includes(step) && (
              <button type="button" onClick={reset} style={retakeBtn}>
                <CameraIcon small /> Ambil Foto Ulang
              </button>
            )}

            {duplicateCheckFailed && step !== 'idle' && <p style={noteStyle}>Pemeriksaan laporan serupa gagal dimuat. Periksa daftar laporan sebelum mengirim atau coba perbarui lokasi.</p>}
            {duplicateUnavailable && !duplicateCheckFailed && step !== 'idle' && (
              <p style={noteStyle}>
                Perbandingan foto otomatis belum tersedia. Sistem memeriksa lokasi dan jenis kerusakan; bandingkan foto laporan yang disarankan sebelum mengirim.
              </p>
            )}
          </div>

          {/* KOLOM KANAN: LOKASI + TINGKAT KERUSAKAN */}
          <div className="rp-col">
            <SectionHeading icon={<PinIcon />} title="Lokasi" />

            {/* Bar lokasi + tombol "Lokasi saat ini" digabung jadi satu, sesuai desain */}
            <div className="rp-location-bar" style={locationBar}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {position
                  ? `Lat: ${position.lat.toFixed(5)} | Lng: ${position.lng.toFixed(5)}`
                  : 'Lokasi belum terdeteksi'}
              </span>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={locatingSelf || busy || !!pendingReport.current}
                style={useLocationBtn}
              >
                <TargetIcon /> {locatingSelf ? 'Mencari…' : 'Lokasi saat ini'}
              </button>
            </div>

            {/* Peta ditampilkan dulu, alamat teks di bawahnya */}
            {position && !duplicate && (
              <div style={{ marginTop: 12, height: mapHeight, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <MapPreview lat={position.lat} lng={position.lng} />
              </div>
            )}

            <p style={locationLine}>
              {' '}
              {addressLoading ? 'Mendeteksi lokasi…' : address || 'Lokasi tidak tersedia'}
            </p>

            <div style={{ marginTop: 24 }}>
              <SectionHeading icon={<WarningIcon />} title="Tingkat Kerusakan" />
              <div style={{ marginTop: 12 }}>
                {hazardVisible ? (
                  <SeverityBadge severity={hazard.severity} />
                ) : (
                  <span style={pendingBadge}>Belum dianalisis</span>
                )}
              </div>
              {hazardVisible && !position && (
                <p style={{ fontSize: 12, color: 'var(--color-ink-soft)', marginTop: 8 }}>
                   Lokasi tidak tersedia — izinkan akses GPS agar laporan lebih akurat.
                </p>
              )}
            </div>
          </div>
        </div>

        {step === 'preparing' && <StatusLine text="Menyiapkan dan mengecilkan foto…" />}
        {step === 'analyzing' && <StatusLine text="Menganalisis foto dengan AI…" />}
        {step === 'checking-duplicate' && <StatusLine text="Memeriksa laporan serupa di sekitar…" />}
        {error && <p style={errorStyle}>{error}</p>}

        {/* DESKRIPSI (FULL WIDTH) */}
        {step === 'analyzed' && hazardVisible && !duplicate && (
          <div className="rp-desc-section" style={rpDescSection}>
            <SectionHeading icon={<NoteIcon />} title="Deskripsi" />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Masukkan Deskripsi…"
              rows={4}
              style={noteInput}
            />
            <button disabled={locatingSelf || !!duplicate} style={submitBtn} onClick={handleSubmitNewReport}>
              Kirim Laporan <SendIcon />
            </button>
          </div>
        )}

        {step === 'submitting' && <StatusLine text="Mengirim laporan…" />}
      </div>

      <DuplicateModal
        candidate={duplicate}
        position={position}
        onSupport={handleSupportExisting}
        onClose={() => setDuplicate(null)}
        busy={step === 'submitting'}
      />
    </section>
  );
}

function computeBboxAreaPct(detections, imageWidth, imageHeight) {
  if (!detections?.length || !imageWidth || !imageHeight) return null;
  const totalBoxArea = detections.reduce((sum, d) => {
    const [, , w, h] = d.bbox;
    return sum + w * h;
  }, 0);
  const imageArea = imageWidth * imageHeight;
  if (imageArea <= 0) return null;
  const pct = (totalBoxArea / imageArea) * 100;
  return Math.min(100, Math.round(pct * 10) / 10);
}

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
              stroke="#F3C581"
              strokeWidth={Math.max(imageWidth * 0.004, 2)}
              rx={4}
            />
            <text
              x={x} y={Math.max(y - 6, 12)}
              fontSize={Math.max(imageWidth * 0.02, 14)}
              fill="#F3C581"
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

function SectionHeading({ icon, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span style={{ color: '#A61C24', flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: 'var(--color-ink-soft)', marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function CameraIcon({ small }) {
  const size = small ? 16 : 22;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3 2 20h20L12 3z" />
      <line x1="12" y1="10" x2="12" y2="14" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <line x1="8" y1="8" x2="16" y2="8" strokeLinecap="round" />
      <line x1="8" y1="12" x2="16" y2="12" strokeLinecap="round" />
      <line x1="8" y1="16" x2="12" y2="16" strokeLinecap="round" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <line x1="12" y1="2" x2="12" y2="5" strokeLinecap="round" />
      <line x1="12" y1="19" x2="12" y2="22" strokeLinecap="round" />
      <line x1="2" y1="12" x2="5" y2="12" strokeLinecap="round" />
      <line x1="19" y1="12" x2="22" y2="12" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" strokeLinejoin="round" />
    </svg>
  );
}

const responsiveCss = `
  .rp-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
  }
  .rp-location-bar {
    flex-wrap: nowrap;
  }
  @media (max-width: 860px) {
    .rp-title { font-size: 22px !important; }
    .rp-subtitle { font-size: 13px !important; }
    .rp-card { padding: 20px !important; border-radius: 16px !important; }
    .rp-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
    .rp-location-bar { flex-wrap: wrap !important; }
  }
`;

const rpTitleStyle = { fontSize: 32, marginBottom: 6 };
const rpSubtitleStyle = { color: 'var(--color-ink-soft)', marginTop: 0, marginBottom: 24, fontSize: 14, maxWidth: 700 };

const modeToggleRow = { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' };

const modeBtnBase = {
  padding: '10px 18px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  border: '1.5px solid #dee2e6',
  background: '#fff',
  color: '#495057'
};
const modeBtnActive = { ...modeBtnBase, border: '1.5px solid #A61C24', background: '#A61C24', color: '#fff' };
const modeBtnActiveWarn = { ...modeBtnBase, border: '1.5px solid #E8A93B', background: '#E8A93B', color: '#1a1a1a' };
const modeBtnInactive = { ...modeBtnBase };

const testingBanner = {
  background: '#FFF8E1',
  border: '1px solid #F0D9A8',
  color: '#8A6D00',
  borderRadius: 10,
  padding: '12px 16px',
  fontSize: 13,
  marginBottom: 16,
  lineHeight: 1.5
};

const rpCardStyle = {
  background: '#fff',
  border: '1px solid var(--color-border, #eee)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-card)',
  padding: '32px'
};

const rpGridStyle = {};
const rpDescSection = { marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--color-border, #eee)' };
const mapHeight = 220;
const retakeBtn = {
  marginTop: 12,
  width: '100%',
  padding: '11px 16px',
  borderRadius: 'var(--radius-md)',
  border: '1.5px solid #A61C24',
  background: '#fff',
  color: '#A61C24',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8
};

const locationBar = {
  marginTop: 16,
  padding: '12px 16px',
  borderRadius: 'var(--radius-md)',
  background: '#FDECEE',
  color: '#A61C24',
  fontSize: 13,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12
};

const useLocationBtn = {
  flexShrink: 0,
  padding: '8px 14px',
  borderRadius: 999,
  border: 'none',
  background: 'transparent',
  color: '#A61C24',
  fontWeight: 700,
  fontSize: 12.5,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  whiteSpace: 'nowrap'
};

const pendingBadge = {
  display: 'inline-block',
  padding: '6px 14px',
  borderRadius: 999,
  background: '#f1f3f5',
  color: '#868e96',
  fontSize: 13,
  fontWeight: 600
};

const primaryBtn = { padding: '13px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-primary)', color: 'var(--color-primary-ink)', fontWeight: 700, fontSize: 15, marginTop: 20 };
const locationLine = { fontSize: 13, color: 'var(--color-ink-soft)', marginTop: 8, marginBottom: 0 };
const noteInput = { width: '100%', marginTop: 16, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' };
const errorStyle = { color: 'var(--sev-emergency)', fontSize: 14, marginTop: 12, fontWeight: 500 };
const noteStyle = { fontSize: 12.5, color: '#8a5a12', background: '#FBF0DA', border: '1px solid #F0D9A8', borderRadius: 'var(--radius-sm)', padding: '8px 10px', marginTop: 12 };

const submitBtn = {
  width: '100%',
  marginTop: 16,
  padding: '15px 20px',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  background: '#A61C24',
  color: '#fff',
  fontWeight: 700,
  fontSize: 16,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10
};
