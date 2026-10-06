import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock3 } from 'lucide-react';
import { prepareUploadPhoto } from '../lib/imageUpload.js';
import ReportPhotoPicker from '../features/report-upload/ReportPhotoPicker.jsx';
import DuplicateModal from '../features/duplicate-check/DuplicateModal.jsx';
import SeverityBadge from '../components/SeverityBadge.jsx';
import { detectDamage } from '../ai/yolo.js';
import { embedImage } from '../ai/clip.js';
import { damageTypeDisplayLabel } from '../ai/hazardScore.js';
import { MAX_REPORT_PHOTOS, summarizePhotoAnalyses } from '../ai/multiPhoto.js';
import { pickBestDuplicate } from '../ai/duplicateScore.js';
import {
  findSimilarReports,
  createReport,
  createDisputedReport,
  uploadReportEvidence,
  addReporter,
} from '../lib/reports.js';
import { reverseGeocode, getCurrentPosition } from '../lib/geolocation.js';
import { readPhotoGpsLocation } from '../lib/exifLocation.js';
import MapPreview from '../components/MapPreview.jsx';
import LocationPicker from '../components/LocationPicker.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { validateReportLocation } from '../lib/reportLocation.js';
import { useNavigate } from 'react-router-dom';
import { useIsMobileDevice } from '../lib/useIsMobileDevice.js';

/* ------------------------------------------------------------------ */
/*  Animasi (di-inject sekali supaya juga berlaku di layar login,      */
/*  sukses, dan menunggu validasi)                                     */
/* ------------------------------------------------------------------ */
const reportAnimCss = `
  @keyframes rpa-fade-up {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes rpa-fade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes rpa-slide-down {
    from { opacity: 0; transform: translateY(-10px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes rpa-pop {
    0%   { opacity: 0; transform: scale(0.5); }
    60%  { opacity: 1; transform: scale(1.12); }
    100% { opacity: 1; transform: scale(1); }
  }
  @keyframes rpa-spin { to { transform: rotate(360deg); } }
  @keyframes rpa-shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-6px); }
    40% { transform: translateX(6px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }
  @keyframes rpa-ring {
    0%   { transform: scale(0.7); opacity: 0.55; }
    100% { transform: scale(1.9); opacity: 0; }
  }
  @keyframes rpa-draw { to { stroke-dashoffset: 0; } }
  @keyframes rpa-indeterminate {
    0%   { left: -40%; }
    100% { left: 100%; }
  }
  @keyframes rpa-swing {
    0%, 100% { transform: rotate(-10deg); }
    50%      { transform: rotate(10deg); }
  }
  @keyframes rpa-wobble {
    0%, 100% { transform: rotate(0); }
    20% { transform: rotate(-9deg); }
    45% { transform: rotate(8deg); }
    70% { transform: rotate(-5deg); }
  }
  @keyframes rpa-pulse-soft {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.55; }
  }

  /* ---------- Masuk halaman ---------- */
  .rpa-enter { animation: rpa-fade-up 0.6s cubic-bezier(.22,1,.36,1) backwards; }
  .rpa-fade { animation: rpa-fade 0.4s ease backwards; }
  .rpa-slide-down { animation: rpa-slide-down 0.35s cubic-bezier(.22,1,.36,1) backwards; }
  .rpa-pop { display: inline-block; animation: rpa-pop 0.45s cubic-bezier(.34,1.56,.64,1) backwards; }
  .rpa-shake { animation: rpa-shake 0.45s ease; }

  /* ---------- Tombol umum ---------- */
  .rpa-btn {
    transition: transform 0.2s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s ease,
                background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
  }
  .rpa-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(166,28,36,0.22); }
  .rpa-btn:active:not(:disabled) { transform: scale(0.96); box-shadow: none; }
  .rpa-btn:disabled { opacity: 0.55; cursor: not-allowed !important; }
  .rpa-btn:focus-visible { outline: 2px solid #A61C24; outline-offset: 2px; }

  .rpa-btn-solid:hover:not(:disabled) { background-color: #8f1820 !important; }
  .rpa-btn-outline:hover:not(:disabled) { background-color: #FDECEE !important; }

  /* Mode toggle */
  .rpa-mode {
    transition: transform 0.2s cubic-bezier(.34,1.56,.64,1), background-color 0.25s ease,
                color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
  }
  .rpa-mode:hover:not(:disabled) { transform: translateY(-2px); border-color: #A61C24 !important; }
  .rpa-mode:active:not(:disabled) { transform: scale(0.96); }
  .rpa-mode:disabled { opacity: 0.6; cursor: not-allowed !important; }
  .rpa-mode:focus-visible { outline: 2px solid #A61C24; outline-offset: 2px; }

  /* Kirim */
  .rpa-send { transition: transform 0.25s cubic-bezier(.34,1.56,.64,1); }
  .rpa-submit:hover:not(:disabled) .rpa-send { transform: translate(4px, -4px) rotate(8deg); }

  /* Kamera */
  .rpa-camera { transition: transform 0.25s ease; }
  .rpa-btn:hover:not(:disabled) .rpa-camera { animation: rpa-wobble 0.6s ease 1; }

  /* Lokasi */
  .rpa-loc-btn { transition: background-color 0.2s ease, transform 0.18s ease, opacity 0.2s ease; }
  .rpa-loc-btn:hover:not(:disabled) { background-color: rgba(166,28,36,0.12) !important; transform: scale(1.04); }
  .rpa-loc-btn:active:not(:disabled) { transform: scale(0.95); }
  .rpa-loc-btn:disabled { opacity: 0.6; cursor: not-allowed !important; }
  .rpa-loc-btn:focus-visible { outline: 2px solid #A61C24; outline-offset: 2px; }
  .rpa-target { transition: transform 0.35s cubic-bezier(.34,1.56,.64,1); }
  .rpa-loc-btn:hover:not(:disabled) .rpa-target { transform: rotate(90deg) scale(1.15); }
  .rpa-target-spin { animation: rpa-spin 1s linear infinite; }

  /* Judul seksi */
  .rpa-heading-icon { display: inline-flex; transition: transform 0.3s cubic-bezier(.34,1.56,.64,1); }
  .rpa-heading:hover .rpa-heading-icon { transform: scale(1.18) rotate(-6deg); }

  /* ---------- Status / progres ---------- */
  .rpa-spinner {
    flex-shrink: 0; width: 15px; height: 15px; border-radius: 50%;
    border: 2.5px solid rgba(166,28,36,0.22); border-top-color: #A61C24;
    animation: rpa-spin 0.75s linear infinite;
  }
  .rpa-progress {
    position: relative; height: 6px; margin-top: 10px; border-radius: 999px;
    background: #f1d6d8; overflow: hidden;
  }
  .rpa-progress-bar {
    height: 100%; border-radius: 999px; background: #A61C24;
    transition: width 0.5s cubic-bezier(.22,1,.36,1);
  }
  .rpa-progress-ind {
    position: absolute; top: 0; height: 100%; width: 40%; border-radius: 999px;
    background: #A61C24; animation: rpa-indeterminate 1.2s ease-in-out infinite;
  }

  /* ---------- Deteksi AI di foto ---------- */
  .rpa-det { animation: rpa-fade 0.4s ease backwards; }
  .rpa-det-rect {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: rpa-draw 0.9s ease forwards;
  }

  /* ---------- Layar sukses / menunggu ---------- */
  .rpa-success { position: relative; display: inline-flex; align-items: center; justify-content: center; }
  .rpa-success::after {
    content: ''; position: absolute; inset: 0; border-radius: 50%;
    border: 2px solid currentColor; opacity: 0;
    animation: rpa-ring 1.1s ease-out 0.25s 2;
  }
  .rpa-success-ok { color: #2f9e44; }
  .rpa-success-wait { color: #f08c00; }
  .rpa-clock-hand { transform-origin: 50% 50%; animation: rpa-swing 2.4s ease-in-out infinite; }

  /* ---------- Modal "tidak terdeteksi" ---------- */
  @keyframes rpa-overlay-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes rpa-panel-in {
    from { opacity: 0; transform: translateY(20px) scale(0.94); }
    to   { opacity: 1; transform: none; }
  }
  .rpa-overlay { animation: rpa-overlay-in 0.25s ease backwards; }
  .rpa-panel { animation: rpa-panel-in 0.35s cubic-bezier(.34,1.3,.64,1) 0.05s backwards; }
  .rpa-warning-icon { animation: rpa-shake 0.5s ease 0.35s; }

  /* Textarea */
  .rpa-textarea { transition: border-color 0.2s ease, box-shadow 0.2s ease; }
  .rpa-textarea:focus {
    outline: none; border-color: #A61C24 !important;
    box-shadow: 0 0 0 3px rgba(166,28,36,0.14);
  }

  /* Badge belum dianalisis */
  .rpa-pending { animation: rpa-pulse-soft 2.2s ease-in-out infinite; }

  /* ---------- Hormati preferensi pengguna ---------- */
  @media (prefers-reduced-motion: reduce) {
    .rpa-enter, .rpa-fade, .rpa-slide-down, .rpa-pop, .rpa-shake, .rpa-det, .rpa-det-rect,
    .rpa-success::after, .rpa-clock-hand, .rpa-overlay, .rpa-panel, .rpa-warning-icon,
    .rpa-pending, .rpa-progress-ind, .rpa-target-spin { animation: none !important; }
    .rpa-det-rect { stroke-dashoffset: 0 !important; }
    .rpa-btn, .rpa-mode, .rpa-send, .rpa-loc-btn, .rpa-target, .rpa-heading-icon,
    .rpa-progress-bar, .rpa-textarea { transition: none !important; }
    .rpa-spinner { animation-duration: 2s !important; }
  }
`;

export default function ReportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobileDevice = useIsMobileDevice();
  const [file, setFile] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [analysisSummary, setAnalysisSummary] = useState(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const uploadProgress = useRef(new Map());
  const selecting = useRef(false);
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
  const pendingSelection = useRef(null);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const busy =
    cameraBusy || ['preparing', 'analyzing', 'checking-duplicate', 'submitting'].includes(step);

  // Inject CSS animasi sekali untuk semua tampilan halaman ini
  useEffect(() => {
    const style = document.createElement('style');
    style.setAttribute('data-rpa-report', '');
    style.textContent = reportAnimCss;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  function changeMode(testing) {
    if (busy) return;
    setTestingMode(testing);
    setError(position ? validateReportLocation(position, testing) : null);
    setDuplicate(null);
  }

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  const hazardVisible = useMemo(
    () => step !== 'idle' && step !== 'analyzing' && hazard,
    [step, hazard]
  );

  function clearAnalysis() {
    setAnalysisSummary(null);
    setDetections([]);
    setImageDims(null);
    setEmbedding(null);
    setFile(null);
    setPreviewUrl(null);
    setHazard(null);
    setDuplicate(null);
    setDuplicateUnavailable(false);
    setDuplicateCheckFailed(false);
  }

  async function handlePhotoSelection({
    files,
    source,
    replaceId,
    position: gps,
    capturedAt: time,
  }) {
    if (selecting.current || pendingReport.current || submitting.current || locationPickerOpen)
      return false;
    const nextCount = photos.length - (replaceId ? 1 : 0) + files.length;
    if (!files.length || nextCount > MAX_REPORT_PHOTOS) {
      setError('Maksimal 5 foto per laporan. Hapus salah satu foto untuk menggantinya.');
      return false;
    }
    selecting.current = true;
    setCameraBusy(false);
    setError(null);
    setStep('preparing');

    // Lokasi yang sudah ada (foto sebelumnya) selalu diprioritaskan agar tetap konsisten.
    let resolvedGps = position || gps || null;

    // Foto dari galeri tidak membawa GPS perangkat — coba baca dari EXIF foto itu sendiri.
    if (!resolvedGps && source === 'gallery') {
      resolvedGps = await readPhotoGpsLocation(files[0]).catch(() => null);
    }

    // EXIF tidak ada sama sekali: minta user pilih titik lokasi manual, dibatasi wilayah Sidoarjo.
    if (!resolvedGps && source === 'gallery') {
      pendingSelection.current = { files, source, replaceId, time };
      selecting.current = false;
      setStep(photos.length ? 'preview' : 'idle');
      setLocationPickerOpen(true);
      return false;
    }

    return finalizeSelection({ files, source, replaceId, resolvedGps, time });
  }

  async function finalizeSelection({ files, source, replaceId, resolvedGps, time }) {
    selecting.current = true;
    try {
      const locationError = resolvedGps && validateReportLocation(resolvedGps, testingMode);
      if (locationError) throw new Error(locationError);
      const additions = [];
      for (const selectedFile of files) {
        const photo = await prepareUploadPhoto(selectedFile);
        additions.push({
          id: crypto.randomUUID(),
          file: photo,
          source,
          capturedAt: time || new Date().toISOString(),
        });
      }
      setPhotos((prev) =>
        replaceId
          ? prev.flatMap((photo) => (photo.id === replaceId ? additions : [photo]))
          : [...prev, ...additions]
      );
      setPosition(resolvedGps);
      setCapturedAt(time || new Date().toISOString());
      clearAnalysis();
      setStep('preview');
      return true;
    } catch (err) {
      setError(err.message);
      setStep(photos.length ? 'preview' : 'idle');
      return false;
    } finally {
      selecting.current = false;
    }
  }

  function handleLocationPicked(point) {
    const pending = pendingSelection.current;
    pendingSelection.current = null;
    setLocationPickerOpen(false);
    if (!pending) return;
    finalizeSelection({ ...pending, resolvedGps: point });
  }

  function handleLocationPickerCancel() {
    pendingSelection.current = null;
    setLocationPickerOpen(false);
  }

  function removePhoto(id) {
    if (busy || pendingReport.current) return;
    const remaining = photos.filter((photo) => photo.id !== id);
    setPhotos(remaining);
    clearAnalysis();
    setError(null);
    setStep(remaining.length ? 'preview' : 'idle');
  }

  async function analyzePhotos() {
    if (busy || !photos.length || pendingReport.current) return;
    clearAnalysis();
    setError(null);
    setAnalysisProgress(0);
    setStep('analyzing');
    const gps = position;
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
      const analyses = [];
      for (const photo of photos) {
        analyses.push(await detectDamage(photo.file));
        setAnalysisProgress(analyses.length);
      }
      const summary = summarizePhotoAnalyses(analyses);
      setAnalysisSummary(summary);
      if (!summary.hazard) {
        setStep('rejected');
        return;
      }
      const photo = photos[summary.representativeIndex].file;
      const {
        detections: dets,
        imageWidth,
        imageHeight,
      } = summary.results[summary.representativeIndex];
      setFile(photo);
      setPreviewUrl(URL.createObjectURL(photo));
      const emb = await runEmbedding(photo);

      setDetections(dets);
      setImageDims({ width: imageWidth, height: imageHeight });
      setEmbedding(emb);

      const hazardResult = summary.hazard;
      setHazard(hazardResult);
      setStep('analyzed');

      if (gps) {
        await checkDuplicates({
          gps,
          damageType: hazardResult.dominant?.damage_type ?? null,
          embedding: emb,
        });
      }
    } catch (err) {
      console.error(err);
      setHazard(null);
      setError('Analisis AI gagal. Periksa koneksi, lalu coba lagi. Foto belum dapat dikirim.');
      setStep('preview');
    }
  }

  function evidenceNote() {
    const summary = analysisSummary.results
      .map((result, index) => {
        const source = photos[index].source === 'gallery' ? 'galeri' : 'kamera';
        const types = [
          ...new Set(result.detections.map((d) => damageTypeDisplayLabel(d.damage_type))),
        ].join(', ');
        return `Foto ${index + 1} (${source}): ${types ? `${types}; skor ${result.hazard.total}` : 'kerusakan tidak terdeteksi'}`;
      })
      .join('\n');
    return [
      testingMode ? '[UJI COBA LOMBA — BEBAS LOKASI]' : '',
      note.trim(),
      `Bukti ${photos.length} foto. Foto utama: ${analysisSummary.representativeIndex + 1}. Skor gabungan memakai median foto dengan deteksi, bukan jaminan akurasi.`,
      summary,
    ]
      .filter(Boolean)
      .join('\n');
  }

  async function saveEvidence(reportId) {
    const primary = photos[analysisSummary.representativeIndex];
    await uploadReportEvidence(
      [primary, ...photos.filter((photo) => photo.id !== primary.id)],
      reportId,
      uploadProgress.current
    );
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
      const candidates = await findSimilarReports({
        lat: gps.lat,
        lng: gps.lng,
        damageType,
        embedding: emb,
      });
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
    if (submitting.current || step !== 'analyzed' || !hazard || !file || locatingSelf || duplicate)
      return;
    const locationError = validateReportLocation(position, testingMode);
    if (locationError) {
      setError(locationError);
      return;
    }
    submitting.current = true;
    setStep('submitting');
    setError(null);
    try {
      const report =
        pendingReport.current ??
        (await createReport({
          damageType: hazard.dominant?.damage_type ?? 'other_corruption',
          confidence: hazard.dominant?.confidence ?? 0,
          hazardScore: hazard.total,
          severity: hazard.severity,
          lat: position.lat,
          lng: position.lng,
          embedding,
          capturedAt,
          note: evidenceNote(),
          bboxAreaPct: computeBboxAreaPct(detections, imageDims?.width, imageDims?.height),
          address,
        }));
      pendingReport.current = report;
      await saveEvidence(report.id);
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
    if (submitting.current || (pendingReport.current && !pendingReport.current.support)) return;
    const locationError = validateReportLocation(position, testingMode);
    if (locationError) {
      setError(locationError);
      return;
    }
    submitting.current = true;
    setStep('submitting');
    setError(null);
    try {
      pendingReport.current = { id: candidate.id, support: true };
      await uploadReportEvidence(photos, candidate.id, uploadProgress.current, false);
      await addReporter(candidate.id);
      pendingReport.current = null;
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

  async function handleDisputeDuplicate() {
    if (
      submitting.current ||
      pendingReport.current?.support ||
      !duplicate ||
      !hazard ||
      !file ||
      !position
    )
      return;
    const locationError = validateReportLocation(position, testingMode);
    if (locationError) {
      setError(locationError);
      return;
    }
    submitting.current = true;
    setStep('submitting');
    setError(null);
    try {
      const report =
        pendingReport.current ??
        (await createDisputedReport({
          damageType: hazard.dominant?.damage_type ?? 'other_corruption',
          confidence: hazard.dominant?.confidence ?? 0,
          hazardScore: hazard.total,
          severity: hazard.severity,
          lat: position.lat,
          lng: position.lng,
          embedding,
          capturedAt,
          note: evidenceNote(),
          bboxAreaPct: computeBboxAreaPct(detections, imageDims?.width, imageDims?.height),
          address,
          candidateId: duplicate.id,
          similarity: duplicate.similarity,
          distanceM: duplicate.distance_m,
        }));
      pendingReport.current = report;
      await saveEvidence(report.id);
      pendingReport.current = null;
      setDuplicate(null);
      setStep('disputed');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Gagal mengirim laporan. Periksa koneksi dan coba lagi.');
      setStep('analyzed');
    } finally {
      submitting.current = false;
    }
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
    } finally {
      setLocatingSelf(false);
    }
  }

  function reset() {
    if (pendingReport.current || busy) return;
    pendingSelection.current = null;
    setLocationPickerOpen(false);
    setPhotos([]);
    setAnalysisSummary(null);
    uploadProgress.current.clear();
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
      <section
        style={{ textAlign: 'center', padding: isMobileDevice ? '48px 20px' : '100px 20px' }}
      >
        <span className="rpa-pop" style={{ display: 'block' }}>
          <svg
            width={isMobileDevice ? 56 : 72}
            height={isMobileDevice ? 56 : 72}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#c92a2a"
            strokeWidth="1.5"
            style={{ margin: '0 auto 20px', display: 'block' }}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="7" x2="12" y2="13" strokeLinecap="round" />
            <circle cx="12" cy="16.5" r="0.75" fill="#c92a2a" stroke="none" />
          </svg>
        </span>
        <h2
          className="rpa-enter"
          style={{
            fontSize: isMobileDevice ? 20 : 28,
            fontWeight: 700,
            margin: '0 0 12px',
            animationDelay: '0.12s',
          }}
        >
          Masuk Untuk Melapor
        </h2>
        <p
          className="rpa-enter"
          style={{
            color: '#868e96',
            fontSize: isMobileDevice ? 13 : 16,
            maxWidth: 480,
            margin: '0 auto 24px',
            lineHeight: 1.5,
            animationDelay: '0.22s',
          }}
        >
          Kamu perlu masuk atau daftar untuk membuat akun dulu supaya laporanmu bisa ditandai atas
          nama kamu dan bisa dilihat warga yang lain
        </p>
        <button
          onClick={() => navigate('/login')}
          className="rpa-btn rpa-btn-outline rpa-enter"
          style={{
            border: '1.5px solid #c92a2a',
            color: '#c92a2a',
            background: '#fff',
            padding: isMobileDevice ? '11px 28px' : '13px 36px',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: isMobileDevice ? 13 : 15,
            cursor: 'pointer',
            animationDelay: '0.32s',
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
        <span className="rpa-success rpa-success-ok rpa-pop" style={{ borderRadius: '50%' }}>
          <CheckCircle2 size={44} color="#2f9e44" style={{ display: 'block' }} aria-hidden="true" />
        </span>
        <h2
          className="display rpa-enter"
          style={{ fontSize: 22, marginTop: 12, animationDelay: '0.2s' }}
        >
          Laporan terkirim
        </h2>
        <p
          className="rpa-enter"
          style={{ color: 'var(--color-ink-soft)', animationDelay: '0.3s' }}
        >
          Terima kasih sudah membantu memantau infrastruktur kota.
        </p>
        <button
          className="rpa-btn rpa-btn-solid rpa-enter"
          style={{ ...primaryBtn, animationDelay: '0.4s' }}
          onClick={reset}
        >
          Lapor kerusakan lain
        </button>
      </section>
    );
  }

  if (step === 'disputed') {
    return (
      <section style={{ textAlign: 'center', paddingTop: 48 }}>
        <span className="rpa-success rpa-success-wait rpa-pop" style={{ borderRadius: '50%' }}>
          <Clock3 size={44} color="#f08c00" style={{ display: 'block' }} aria-hidden="true" />
        </span>
        <h2
          className="display rpa-enter"
          style={{ fontSize: 22, marginTop: 12, animationDelay: '0.2s' }}
        >
          Menunggu Validasi Admin
        </h2>
        <p
          className="rpa-enter"
          style={{
            color: 'var(--color-ink-soft)',
            maxWidth: 480,
            margin: '8px auto 0',
            lineHeight: 1.5,
            animationDelay: '0.3s',
          }}
        >
          AI mendeteksi laporanmu mirip dengan laporan lain, tapi kamu menandainya sebagai kerusakan
          berbeda. Laporan ini sudah tercatat di riwayatmu dengan status{' '}
          <strong>"Menunggu Validasi Admin"</strong> dan akan diperiksa admin sebelum tampil di
          daftar laporan publik.
        </p>
        <button
          className="rpa-btn rpa-btn-solid rpa-enter"
          style={{ ...primaryBtn, animationDelay: '0.4s' }}
          onClick={reset}
        >
          Lapor kerusakan lain
        </button>
      </section>
    );
  }

  const locationKey = position ? `${position.lat}-${position.lng}` : 'none';

  return (
    <section className="rp-wrap" style={{ paddingBottom: isMobileDevice ? 90 : 24 }}>
      <style>{responsiveCss}</style>

      <h1 className="display rp-title rpa-enter" style={rpTitleStyle}>
        Buat Laporan Kerusakan Jalan
      </h1>
      <p className="rp-subtitle rpa-enter" style={{ ...rpSubtitleStyle, animationDelay: '0.08s' }}>
        Ambil foto atau pilih dari galeri. Sertakan beberapa sudut dari kerusakan yang sama, periksa
        fotonya, lalu mulai analisis AI.
      </p>

      <div className="rpa-enter" style={{ ...modeToggleRow, animationDelay: '0.16s' }}>
        <button
          type="button"
          className="rpa-mode"
          disabled={busy || locatingSelf || !!pendingReport.current}
          aria-pressed={!testingMode}
          onClick={() => changeMode(false)}
          style={testingMode ? modeBtnInactive : modeBtnActive}
        >
          Laporan Real (Khusus Sidoarjo)
        </button>
        <button
          type="button"
          className="rpa-mode"
          disabled={busy || locatingSelf || !!pendingReport.current}
          aria-pressed={testingMode}
          onClick={() => changeMode(true)}
          style={testingMode ? modeBtnActiveWarn : modeBtnInactive}
        >
          Mode Uji Coba (Bebas Lokasi)
        </button>
      </div>

      {testingMode && (
        <div className="rpa-slide-down" style={testingBanner}>
          ⚠️ <strong>Mode Uji Coba aktif</strong> — laporan bisa dikirim dari lokasi mana saja untuk
          keperluan demo/testing. Di penggunaan nyata, Jasida difokuskan hanya untuk laporan
          kerusakan jalan di wilayah Kabupaten Sidoarjo.
        </div>
      )}

      <div className="rp-card rpa-enter" style={{ ...rpCardStyle, animationDelay: '0.24s' }}>
        <div className="rp-grid" style={rpGridStyle}>
          {/* KOLOM KIRI: FOTO */}
          <div className="rp-col rpa-enter" style={{ animationDelay: '0.34s' }}>
            <SectionHeading
              icon={<CameraIcon />}
              title="Foto Kerusakan"
              subtitle="Kamera atau galeri · maksimal 5 foto"
            />

            <div className="rp-photo-box" style={{ marginTop: 16, position: 'relative' }}>
              <ReportPhotoPicker
                photos={photos}
                onSelect={handlePhotoSelection}
                onRemove={removePhoto}
                onBusyChange={setCameraBusy}
                disabled={busy || locatingSelf || !!pendingReport.current || !!duplicate}
              />
              {photos.length > 0 && ['preview', 'idle'].includes(step) && (
                <button
                  type="button"
                  className="rpa-btn rpa-btn-solid rpa-slide-down"
                  style={primaryBtn}
                  onClick={analyzePhotos}
                  disabled={busy || locatingSelf}
                >
                  Analisis Foto
                </button>
              )}
              {previewUrl && hazard && (
                <div className="rpa-fade" style={{ position: 'relative' }}>
                  <p>Hasil foto utama (foto {analysisSummary?.representativeIndex + 1})</p>
                  <div style={{ position: 'relative' }}>
                    <img
                      src={previewUrl}
                      alt="Foto kondisi jalan yang baru diambil"
                      style={{ width: '100%', borderRadius: 'var(--radius-lg)', display: 'block' }}
                    />
                    {imageDims && detections.length > 0 && (
                      <DetectionOverlay
                        detections={detections}
                        imageWidth={imageDims.width}
                        imageHeight={imageDims.height}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {analysisSummary && step !== 'rejected' && (
              <div className="rpa-slide-down" style={noteStyle}>
                <strong>
                  {analysisSummary.positiveCount} dari {photos.length} foto menunjukkan dugaan
                  kerusakan.
                </strong>
                <ul>
                  {analysisSummary.results.map((result, index) => (
                    <li
                      key={photos[index].id}
                      className="rpa-fade"
                      style={{ animationDelay: `${0.1 + index * 0.07}s` }}
                    >
                      Foto {index + 1}:{' '}
                      {result.detections.length
                        ? `${[...new Set(result.detections.map((d) => damageTypeDisplayLabel(d.damage_type)))].join(', ')} · skor ${result.hazard.total}`
                        : 'kerusakan tidak terdeteksi'}
                    </li>
                  ))}
                </ul>
                <p>
                  Skor gabungan memakai nilai tengah dari foto dengan deteksi. Foto dari sudut
                  berbeda membantu pemeriksaan petugas; hasil AI tetap perlu diverifikasi.
                </p>
                {analysisSummary.positiveCount < photos.length && (
                  <p>
                    Hasil antar foto berbeda. Pastikan semua foto menunjukkan lokasi yang sama dan
                    detail kerusakannya terlihat jelas.
                  </p>
                )}
              </div>
            )}

            {previewUrl && ['analyzed', 'idle'].includes(step) && (
              <button
                type="button"
                className="rpa-btn rpa-btn-outline rpa-slide-down"
                disabled={busy || !!pendingReport.current}
                onClick={reset}
                style={retakeBtn}
              >
                <CameraIcon small /> Ambil Foto Ulang
              </button>
            )}

            {duplicateCheckFailed && step !== 'idle' && (
              <p className="rpa-slide-down" style={noteStyle}>
                Pemeriksaan laporan serupa gagal dimuat. Periksa daftar laporan sebelum mengirim
                atau coba perbarui lokasi.
              </p>
            )}
            {duplicateUnavailable && !duplicateCheckFailed && step !== 'idle' && (
              <p className="rpa-slide-down" style={noteStyle}>
                Perbandingan foto otomatis belum tersedia. Sistem memeriksa lokasi dan jenis
                kerusakan; bandingkan foto laporan yang disarankan sebelum mengirim.
              </p>
            )}
          </div>

          {/* KOLOM KANAN: LOKASI + TINGKAT KERUSAKAN */}
          <div className="rp-col rpa-enter" style={{ animationDelay: '0.44s' }}>
            <SectionHeading icon={<PinIcon />} title="Lokasi" />

            {/* Bar lokasi + tombol "Lokasi saat ini" digabung jadi satu, sesuai desain */}
            <div className="rp-location-bar" style={locationBar}>
              <span
                key={locationKey}
                className="rpa-fade"
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {position
                  ? `Lat: ${position.lat.toFixed(5)} | Lng: ${position.lng.toFixed(5)}`
                  : 'Lokasi belum terdeteksi'}
              </span>
              <button
                type="button"
                className="rpa-loc-btn"
                onClick={handleUseCurrentLocation}
                disabled={locatingSelf || busy || !!pendingReport.current}
                style={useLocationBtn}
              >
                <TargetIcon spinning={locatingSelf} /> {locatingSelf ? 'Mencari…' : 'Lokasi saat ini'}
              </button>
            </div>

            {/* Peta ditampilkan dulu, alamat teks di bawahnya */}
            {position && !duplicate && (
              <div
                className="rpa-fade"
                style={{
                  marginTop: 12,
                  height: mapHeight,
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                }}
              >
                <MapPreview lat={position.lat} lng={position.lng} />
              </div>
            )}

            <p
              key={addressLoading ? 'loading' : address || 'none'}
              className="rpa-fade"
              style={locationLine}
            >
              {' '}
              {addressLoading ? 'Mendeteksi lokasi…' : address || 'Lokasi tidak tersedia'}
            </p>

            <div style={{ marginTop: 24 }}>
              <SectionHeading icon={<WarningIcon />} title="Tingkat Kerusakan" />
              <div style={{ marginTop: 12 }}>
                {hazardVisible ? (
                  <span key={hazard.severity} className="rpa-pop">
                    <SeverityBadge severity={hazard.severity} />
                  </span>
                ) : (
                  <span
                    className={step === 'analyzing' ? 'rpa-pending' : undefined}
                    style={pendingBadge}
                  >
                    {step === 'analyzing' ? 'Sedang dianalisis…' : 'Belum dianalisis'}
                  </span>
                )}
              </div>
              {hazardVisible && !position && (
                <p
                  className="rpa-slide-down"
                  style={{ fontSize: 12, color: 'var(--color-ink-soft)', marginTop: 8 }}
                >
                  Lokasi tidak tersedia — izinkan akses GPS agar laporan lebih akurat.
                </p>
              )}
            </div>
          </div>
        </div>

        {step === 'preparing' && <StatusLine text="Menyiapkan dan mengecilkan foto…" indeterminate />}
        {step === 'analyzing' && (
          <StatusLine
            text={`Menganalisis foto dengan AI… ${analysisProgress}/${photos.length}`}
            progress={photos.length ? analysisProgress / photos.length : 0}
          />
        )}
        {step === 'checking-duplicate' && (
          <StatusLine text="Memeriksa laporan serupa di sekitar…" indeterminate />
        )}
        {error && !duplicate && (
          <p key={error} role="alert" className="rpa-shake" style={errorStyle}>
            {error}
          </p>
        )}
        {!!pendingReport.current && step === 'analyzed' && (
          <p role="status" className="rpa-slide-down" style={noteStyle}>
            Sebagian bukti belum tersimpan. Tekan kirim lagi untuk melanjutkan unggahan pada laporan
            yang sama. Jangan tutup halaman ini.
          </p>
        )}

        {/* DESKRIPSI (FULL WIDTH) */}
        {step === 'analyzed' && hazardVisible && !duplicate && (
          <div className="rp-desc-section rpa-enter" style={rpDescSection}>
            <SectionHeading icon={<NoteIcon />} title="Deskripsi" />
            <textarea
              className="rpa-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Masukkan Deskripsi…"
              rows={4}
              disabled={!!pendingReport.current}
              style={noteInput}
            />
            <button
              disabled={locatingSelf || !!duplicate}
              className="rpa-btn rpa-btn-solid rpa-submit"
              style={submitBtn}
              onClick={handleSubmitNewReport}
            >
              Kirim Laporan <SendIcon />
            </button>
          </div>
        )}

        {step === 'submitting' && <StatusLine text="Mengirim laporan…" indeterminate />}
      </div>

      <DuplicateModal
        candidate={duplicate}
        position={position}
        onSupport={handleSupportExisting}
        onDispute={handleDisputeDuplicate}
        onClose={() => {
          if (!pendingReport.current) setDuplicate(null);
        }}
        busy={step === 'submitting'}
        pendingAction={
          pendingReport.current ? (pendingReport.current.support ? 'support' : 'dispute') : null
        }
        error={error}
      />

      {locationPickerOpen && (
        <LocationPicker
          testingMode={testingMode}
          onConfirm={handleLocationPicked}
          onCancel={handleLocationPickerCancel}
        />
      )}

      {step === 'rejected' && (
        <div
          className="rpa-overlay"
          style={rejectedOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="rejected-title"
        >
          <div className="rpa-panel" style={rejectedPanel}>
            <WarningIcon2 />
            <h2 id="rejected-title" className="display" style={{ fontSize: 20, marginTop: 12 }}>
              Kerusakan Jalan Tidak Terdeteksi
            </h2>
            <p
              style={{
                color: 'var(--color-ink-soft)',
                fontSize: 14,
                margin: '8px 0 0',
                lineHeight: 1.5,
              }}
            >
              AI tidak menemukan tanda-tanda kerusakan jalan (lubang/retak) pada foto-foto ini, jadi
              laporan tidak bisa dikirim. Pastikan foto diambil dari jarak yang jelas menunjukkan
              bagian jalan yang rusak, lalu coba lagi.
            </p>
            <button
              className="rpa-btn rpa-btn-solid"
              style={{ ...primaryBtn, width: '100%' }}
              onClick={() => {
                clearAnalysis();
                setStep('preview');
              }}
            >
              Periksa Foto Lagi
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function WarningIcon2() {
  return (
    <svg
      className="rpa-warning-icon"
      width="44"
      height="44"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#A61C24"
      strokeWidth="1.8"
      style={{ display: 'block', margin: '0 auto' }}
      aria-hidden="true"
    >
      <path d="M12 3 2 20h20L12 3z" />
      <line x1="12" y1="10" x2="12" y2="14" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.75" fill="#A61C24" stroke="none" />
    </svg>
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
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      {detections.map((d, i) => {
        const [x, y, w, h] = d.bbox;
        return (
          <g key={`${d.damage_type}-${i}`}>
            <rect
              className="rpa-det-rect"
              pathLength="1"
              x={x}
              y={y}
              width={w}
              height={h}
              fill="none"
              stroke="#F3C581"
              strokeWidth={Math.max(imageWidth * 0.004, 2)}
              rx={4}
              style={{ animationDelay: `${i * 0.12}s` }}
            />
            <text
              className="rpa-det"
              x={x}
              y={Math.max(y - 6, 12)}
              fontSize={Math.max(imageWidth * 0.02, 14)}
              fill="#F3C581"
              style={{ fontWeight: 700, animationDelay: `${0.5 + i * 0.12}s` }}
            >
              {damageTypeDisplayLabel(d.damage_type)} {Math.round(d.confidence * 100)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function StatusLine({ text, progress, indeterminate }) {
  return (
    <div role="status" className="rpa-slide-down" style={{ marginTop: 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 14,
          color: 'var(--color-primary)',
          fontWeight: 600,
        }}
      >
        <span className="rpa-spinner" aria-hidden="true" />
        <span>{text}</span>
      </div>
      {(indeterminate || typeof progress === 'number') && (
        <div className="rpa-progress" aria-hidden="true">
          {indeterminate ? (
            <div className="rpa-progress-ind" />
          ) : (
            <div
              className="rpa-progress-bar"
              style={{ width: `${Math.max(6, Math.min(100, progress * 100))}%` }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeading({ icon, title, subtitle }) {
  return (
    <div className="rpa-heading" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span style={{ color: '#A61C24', flexShrink: 0, marginTop: 2 }}>
        <span className="rpa-heading-icon">{icon}</span>
      </span>
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a' }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 13, color: 'var(--color-ink-soft)', marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

function CameraIcon({ small }) {
  const size = small ? 16 : 22;
  return (
    <svg
      className="rpa-camera"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M12 3 2 20h20L12 3z" />
      <line x1="12" y1="10" x2="12" y2="14" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <line x1="8" y1="8" x2="16" y2="8" strokeLinecap="round" />
      <line x1="8" y1="12" x2="16" y2="12" strokeLinecap="round" />
      <line x1="8" y1="16" x2="12" y2="16" strokeLinecap="round" />
    </svg>
  );
}

function TargetIcon({ spinning }) {
  return (
    <svg
      className={spinning ? 'rpa-target-spin' : 'rpa-target'}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
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
    <svg
      className="rpa-send"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
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
const rpSubtitleStyle = {
  color: 'var(--color-ink-soft)',
  marginTop: 0,
  marginBottom: 24,
  fontSize: 14,
  maxWidth: 700,
};

const modeToggleRow = { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' };

const modeBtnBase = {
  padding: '10px 18px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  border: '1.5px solid #dee2e6',
  background: '#fff',
  color: '#495057',
};
const modeBtnActive = {
  ...modeBtnBase,
  border: '1.5px solid #A61C24',
  background: '#A61C24',
  color: '#fff',
};
const modeBtnActiveWarn = {
  ...modeBtnBase,
  border: '1.5px solid #A61C24',
  background: '#A61C24',
  color: '#fff',
};
const modeBtnInactive = { ...modeBtnBase };

const testingBanner = {
  background: '#FFF8E1',
  border: '1px solid #F0D9A8',
  color: '#8A6D00',
  borderRadius: 10,
  padding: '12px 16px',
  fontSize: 13,
  marginBottom: 16,
  lineHeight: 1.5,
};

const rpCardStyle = {
  background: '#fff',
  border: '1px solid var(--color-border, #eee)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-card)',
  padding: '32px',
};

const rpGridStyle = {};
const rpDescSection = {
  marginTop: 32,
  paddingTop: 24,
  borderTop: '1px solid var(--color-border, #eee)',
};
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
  gap: 8,
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
  gap: 12,
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
  whiteSpace: 'nowrap',
};

const pendingBadge = {
  display: 'inline-block',
  padding: '6px 14px',
  borderRadius: 999,
  background: '#f1f3f5',
  color: '#868e96',
  fontSize: 13,
  fontWeight: 600,
};

const primaryBtn = {
  padding: '13px 20px',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  background: '#A61C24',
  color: '#fff',
  fontWeight: 700,
  fontSize: 15,
  marginTop: 20,
  cursor: 'pointer',
};

const rejectedOverlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(25,27,31,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 2000,
};

const rejectedPanel = {
  width: '100%',
  maxWidth: 420,
  background: '#fff',
  borderRadius: 16,
  padding: '28px 24px',
  textAlign: 'center',
  boxShadow: 'var(--shadow-card)',
};
const locationLine = {
  fontSize: 13,
  color: 'var(--color-ink-soft)',
  marginTop: 8,
  marginBottom: 0,
};
const noteInput = {
  width: '100%',
  marginTop: 16,
  padding: '12px 14px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  fontSize: 14,
  fontFamily: 'inherit',
  resize: 'vertical',
};
const errorStyle = { color: 'var(--sev-emergency)', fontSize: 14, marginTop: 12, fontWeight: 500 };
const noteStyle = {
  fontSize: 12.5,
  color: '#8a5a12',
  background: '#FBF0DA',
  border: '1px solid #F0D9A8',
  borderRadius: 'var(--radius-sm)',
  padding: '8px 10px',
  marginTop: 12,
};

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
  gap: 10,
};