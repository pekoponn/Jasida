import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchAllReportsForAdmin,
  rejectReport,
  acceptReport,
  startProgress,
  completeReportWithActuals,
} from '../lib/reports.js';
import { damageTypeDisplayLabel, severityDisplayLabel } from '../ai/hazardScore.js';
import { estimateMaterialsAndCost, formatMaterialItems } from '../ai/materialEstimate.js';
import { findKecamatan, getKecamatanNames } from '../lib/kecamatanBoundaries.js';
import { prepareUploadPhoto } from '../lib/imageUpload.js';
import ZoomableImage from '../components/ZoomableImage.jsx';
import CustomSelect from '../components/CustomSelect.jsx';
import ReportDetailModal from '../components/ReportDetailModal.jsx';
import CustomDateRangePicker from '../components/CustomDateRangePicker.jsx';

const MAX_PROOF_PHOTOS = 5;

const STATUS_LABEL = {
  open: 'Menunggu Verifikasi',
  rejected: 'Ditolak',
  accepted: 'Menunggu Dikerjakan',
  in_progress: 'Sedang Dikerjakan',
  resolved: 'Selesai',
  pending_duplicate_review: 'Menunggu Validasi Admin',
};

const STATUS_COLOR = {
  open: { bg: '#FFF3CD', color: '#8A6D00' },
  rejected: { bg: '#FDECEE', color: '#A61C24' },
  accepted: { bg: '#E7F1FF', color: '#1c5dcf' },
  in_progress: { bg: '#E3F1FD', color: '#1c7ed6' },
  resolved: { bg: '#E6F8EC', color: '#1c8a4b' },
  pending_duplicate_review: { bg: '#E7DFFB', color: '#5F3DC4' },
};

const FILTER_TABS = [
  { key: 'all', label: 'Semua' },
  { key: 'open', label: 'Masuk' },
  { key: 'accepted', label: 'Diterima' },
  { key: 'in_progress', label: 'Dikerjakan' },
  { key: 'resolved', label: 'Selesai' },
  { key: 'rejected', label: 'Ditolak' },
];

const SEVERITY_OPTIONS = [
  { key: '', label: 'Semua Tingkat' },
  { key: 'aman', label: 'Aman' },
  { key: 'sedang', label: 'Sedang' },
  { key: 'darurat', label: 'Darurat' },
];

const SEVERITY_COLOR = {
  aman: { bg: '#E6F8EC', color: '#1c8a4b' },
  sedang: { bg: '#FFF3CD', color: '#8A6D00' },
  darurat: { bg: '#FDECEE', color: '#A61C24' },
};

const SEVERITY_ALIAS = {
  medium: 'sedang',
  emergency: 'darurat',
  low: 'aman',
  safe: 'aman',
};

function normalizeSeverity(severity) {
  return SEVERITY_ALIAS[severity] ?? severity;
}

export default function AdminKelolaLaporanPage() {
  const [detailReport, setDetailReport] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);

  const [rejectTarget, setRejectTarget] = useState(null);
  const [progressTarget, setProgressTarget] = useState(null);
  const [completeTarget, setCompleteTarget] = useState(null);

  const [severityFilter, setSeverityFilter] = useState('');
  const [kecamatanFilter, setKecamatanFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [zoomImage, setZoomImage] = useState(null);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const REPORTS_PER_PAGE = 10;

  const kecamatanOptions = useMemo(() => getKecamatanNames(), []);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllReportsForAdmin({});
      setReports(data);
    } catch (err) {
      console.error(err);
      setError('Gagal memuat laporan: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function patchLocal(reportId, patch) {
    setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, ...patch } : r)));
  }

  async function handleAccept(report) {
    setBusyId(report.id);
    try {
      await acceptReport(report.id);
      patchLocal(report.id, { status: 'accepted' });
    } catch (err) {
      alert('Gagal menerima laporan: ' + err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(reportId, reason) {
    setBusyId(reportId);
    try {
      await rejectReport(reportId, reason);
      patchLocal(reportId, {
        status: 'rejected',
        rejection_reason: reason,
        rejected_at: new Date().toISOString(),
      });
      setRejectTarget(null);
    } catch (err) {
      alert('Gagal menolak laporan: ' + err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleStartProgress(reportId, { estimatedDate, materials, materialsJson, cost }) {
    setBusyId(reportId);
    try {
      await startProgress(reportId, { estimatedDate, materials, materialsJson, cost });
      patchLocal(reportId, {
        status: 'in_progress',
        started_at: new Date().toISOString(),
        estimated_completion_date: estimatedDate,
        estimated_materials: materials,
        estimated_materials_json: materialsJson,
        estimated_cost: cost,
      });
      setProgressTarget(null);
    } catch (err) {
      alert('Gagal memulai pengerjaan: ' + err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleComplete(
    reportId,
    {
      file,
      files,
      actualMaterials,
      actualMaterialsJson,
      actualCost,
      fallbackEstimatedCost,
      fallbackEstimatedMaterials,
      fallbackEstimatedMaterialsJson,
    }
  ) {
    setBusyId(reportId);
    try {
      await completeReportWithActuals(reportId, {
        file, // foto pertama (utama) — tetap dikirim agar kompatibel dengan kode lama
        files, // semua foto bukti (maks. 5)
        actualMaterials,
        actualMaterialsJson,
        actualCost,
        fallbackEstimatedCost,
        fallbackEstimatedMaterials,
        fallbackEstimatedMaterialsJson,
      });
      patchLocal(reportId, {
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        actual_materials: actualMaterials,
        actual_materials_json: actualMaterialsJson,
        actual_cost: actualCost,
        ...(fallbackEstimatedCost != null
          ? {
              estimated_cost: fallbackEstimatedCost,
              estimated_materials: fallbackEstimatedMaterials,
              estimated_materials_json: fallbackEstimatedMaterialsJson,
            }
          : {}),
      });
      setCompleteTarget(null);
    } catch (err) {
      alert('Gagal menandai selesai: ' + err.message);
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return reports.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false;
      if (severityFilter && normalizeSeverity(r.severity) !== severityFilter) return false;

      if (dateFrom && new Date(r.created_at) < new Date(dateFrom)) return false;
      if (dateTo) {
        const toEnd = new Date(dateTo);
        toEnd.setHours(23, 59, 59, 999);
        if (new Date(r.created_at) > toEnd) return false;
      }

      if (kecamatanFilter) {
        const nama =
          typeof r.lat === 'number' && typeof r.lng === 'number'
            ? findKecamatan(r.lat, r.lng)
            : null;
        if (nama !== kecamatanFilter) return false;
      }

      if (q) {
        const kode = `#${String(r.id).slice(0, 6).toUpperCase()}-JASIDA`.toLowerCase();
        const nama = (r.profile?.username ?? '').toLowerCase();
        if (!kode.includes(q) && !nama.includes(q)) return false;
      }

      return true;
    });
  }, [reports, filter, severityFilter, kecamatanFilter, searchQuery, dateFrom, dateTo]);

  // Setiap filter berubah, kembali ke halaman 1
  useEffect(() => {
    setPage(0);
  }, [filter, severityFilter, kecamatanFilter, searchQuery, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / REPORTS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedReports = useMemo(() => {
    const start = currentPage * REPORTS_PER_PAGE;
    return filtered.slice(start, start + REPORTS_PER_PAGE);
  }, [filtered, currentPage]);

  return (
    <section>
      <style>{reportPhotoCss}</style>
      <h1 className="display" style={{ fontSize: 24, marginBottom: 4 }}>
        Kelola Laporan
      </h1>
      <p style={{ color: '#868e96', marginTop: 0, fontSize: 14 }}>
        Proses laporan warga: terima/tolak, jadwalkan pengerjaan, lalu tandai selesai.
      </p>

      {error && <p style={{ color: '#e03131', marginTop: 12 }}>{error}</p>}
      {loading && <p style={{ marginTop: 12 }}>Memuat laporan…</p>}

      {!loading && (
        <div style={panelCard}>
                    <div className="report-toolbar" style={toolbarRow}>
            <input
              type="text"
              className="rf-search"
              placeholder="Cari kode laporan atau nama pelapor…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={searchInputStyle}
            />

            <div className="rf-item rf-status">
              <CustomSelect
                value={filter}
                onChange={setFilter}
                placeholder="Semua"
                options={FILTER_TABS.map((tab) => ({
                  value: tab.key,
                  label:
                    tab.key !== 'all'
                      ? `${tab.label} (${reports.filter((r) => r.status === tab.key).length})`
                      : tab.label,
                }))}
              />
            </div>

            <div className="rf-item rf-level">
              <CustomSelect
                value={severityFilter}
                onChange={setSeverityFilter}
                placeholder="Semua Tingkat"
                options={SEVERITY_OPTIONS.map((opt) => ({ value: opt.key, label: opt.label }))}
              />
            </div>

            <div className="rf-item rf-kec">
              <CustomSelect
                value={kecamatanFilter}
                onChange={setKecamatanFilter}
                options={kecamatanOptions}
                placeholder="Semua Kecamatan"
              />
            </div>

            <div className="rf-item rf-date">
              <CustomDateRangePicker
                startDate={dateFrom}
                endDate={dateTo}
                onChange={(from, to) => {
                  setDateFrom(from);
                  setDateTo(to);
                }}
              />
            </div>

            {(filter !== 'all' ||
              severityFilter ||
              kecamatanFilter ||
              searchQuery ||
              dateFrom ||
              dateTo) && (
              <button
                type="button"
                style={{ ...secondaryBtn, flexShrink: 0 }}
                onClick={() => {
                  setFilter('all');
                  setSeverityFilter('');
                  setKecamatanFilter('');
                  setSearchQuery('');
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                Reset
              </button>
            )}
          </div>

          <div className="report-table-wrap">
            <table className="report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#A61C24', color: '#fff', textAlign: 'left' }}>
                  <th style={th}>Kode</th>
                  <th style={th}>Pelapor</th>
                  <th style={th}>Lokasi</th>
                  <th style={th}>Waktu Lapor</th>
                  <th style={th}>Foto</th>
                  <th style={th}>Kondisi</th>
                  <th style={th}>Status</th>
                  <th className="col-sticky-head" style={th}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td style={td} colSpan={8}>
                      Tidak ada laporan.
                    </td>
                  </tr>
                )}
                {pagedReports.map((r) => (
                  <RowItem
                    key={r.id}
                    report={r}
                    busy={busyId === r.id}
                    onAccept={() => handleAccept(r)}
                    onRejectClick={() => setRejectTarget(r)}
                    onProgressClick={() => setProgressTarget(r)}
                    onCompleteClick={() => setCompleteTarget(r)}
                    onZoomPhoto={() => setZoomImage(r.imageUrl)}
                    onDetail={() => setDetailReport(r)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div style={pagerRow}>
            <span style={{ fontSize: 12.5, color: '#868e96' }}>
              {filtered.length === 0
                ? 'Tidak ada data'
                : `Menampilkan ${currentPage * REPORTS_PER_PAGE + 1}–${Math.min(
                    (currentPage + 1) * REPORTS_PER_PAGE,
                    filtered.length
                  )} dari ${filtered.length} laporan`}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                style={{ ...pageNumBtn, opacity: currentPage === 0 ? 0.4 : 1 }}
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
                aria-label="Halaman sebelumnya"
              >
                ‹
              </button>
              {getPageWindow(currentPage, totalPages).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  aria-current={p === currentPage ? 'page' : undefined}
                  style={p === currentPage ? { ...pageNumBtn, ...pageNumBtnActive } : pageNumBtn}
                >
                  {p + 1}
                </button>
              ))}
              <button
                type="button"
                style={{ ...pageNumBtn, opacity: currentPage >= totalPages - 1 ? 0.4 : 1 }}
                disabled={currentPage >= totalPages - 1}
                onClick={() => setPage(currentPage + 1)}
                aria-label="Halaman berikutnya"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      )}

      {createPortal(
        <>
      {detailReport &&
        createPortal(
          <ReportDetailModal report={detailReport} onClose={() => setDetailReport(null)} />,
          document.body
        )}
      {rejectTarget &&
        createPortal(
          <RejectModal
            report={rejectTarget}
            onCancel={() => setRejectTarget(null)}
            onConfirm={(reason) => handleReject(rejectTarget.id, reason)}
          />,
          document.body
        )}

      {progressTarget &&
        createPortal(
          <ProgressModal
            report={progressTarget}
            onCancel={() => setProgressTarget(null)}
            onConfirm={(payload) => handleStartProgress(progressTarget.id, payload)}
          />,
          document.body
        )}

=      {completeTarget &&
        createPortal(
          <CompleteModal
            report={completeTarget}
            onCancel={() => setCompleteTarget(null)}
            onConfirm={(payload) => handleComplete(completeTarget.id, payload)}
          />,
          document.body
        )}

      {zoomImage && (
        <div style={zoomOverlay} onClick={() => setZoomImage(null)}>
          <img
            src={zoomImage}
            alt="Foto laporan diperbesar"
            style={zoomImg}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            style={zoomCloseBtn}
            onClick={() => setZoomImage(null)}
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>
      )}
        </>,
        document.body
      )}
    </section>
  );
}

function RowItem({
  report,
  busy,
  onAccept,
  onRejectClick,
  onProgressClick,
  onCompleteClick,
  onZoomPhoto,
  onDetail,
}) {
  const statusColor = STATUS_COLOR[report.status] ?? STATUS_COLOR.open;
  const normalizedSeverity = normalizeSeverity(report.severity);
  const severityColor = SEVERITY_COLOR[normalizedSeverity] ?? SEVERITY_COLOR.aman;
  const kode = `#${String(report.id).slice(0, 6).toUpperCase()}-JASIDA`;
  const nama = report.profile?.username ?? '-';
  const lokasi =
    typeof report.lat === 'number' && typeof report.lng === 'number'
      ? (findKecamatan(report.lat, report.lng) ?? '-')
      : '-';

  return (
    <tr style={{ borderBottom: '1px solid #eee' }}>
      <td style={td}>
        <span style={codeText}>{kode}</span>
      </td>
      <td style={td}>{nama}</td>
      <td style={td}>{lokasi}</td>
      <td style={tdNowrap}>
        <div style={dateMain}>{new Date(report.created_at).toLocaleDateString('id-ID')}</div>
        <div style={dateTime}>
          {new Date(report.created_at).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </td>
      <td style={td}>
        <div className="report-photo-thumb">
          <ZoomableImage
            src={report.imageUrl}
            alt={damageTypeDisplayLabel(report.damage_type)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
        <button type="button" onClick={onDetail} style={photoLinkBtn}>
          Semua Foto
        </button>
      </td>
      <td style={td}>
        <div style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
          {damageTypeDisplayLabel(report.damage_type)}
        </div>
        <div style={{ fontSize: 11.5, color: '#868e96', marginTop: 2 }}>
          Skor {report.hazard_score}
        </div>
        {report.severity && (
          <span
            style={{
              ...badge,
              background: severityColor.bg,
              color: severityColor.color,
              marginTop: 4,
            }}
          >
            {severityDisplayLabel(normalizedSeverity)}
          </span>
        )}
      </td>
      <td style={td}>
        <span style={{ ...badge, background: statusColor.bg, color: statusColor.color }}>
          {STATUS_LABEL[report.status] ?? report.status}
        </span>
        {report.status === 'rejected' && report.rejection_reason && (
          <div style={{ fontSize: 11, color: '#868e96', marginTop: 4, maxWidth: 180 }}>
            Alasan: {report.rejection_reason}
          </div>
        )}
        {report.status === 'in_progress' && report.estimated_completion_date && (
          <div style={{ fontSize: 11, color: '#868e96', marginTop: 4 }}>
            Estimasi selesai:{' '}
            {new Date(report.estimated_completion_date).toLocaleDateString('id-ID')}
          </div>
        )}
      </td>
      <td className="col-sticky" style={td}>
        {report.status === 'open' && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              style={{ ...actionBtn, background: '#2f9e44' }}
              disabled={busy}
              onClick={onAccept}
            >
              Terima
            </button>
            <button
              style={{ ...actionBtn, background: '#A61C24' }}
              disabled={busy}
              onClick={onRejectClick}
            >
              Tolak
            </button>
          </div>
        )}
        {report.status === 'accepted' && (
          <button
            style={{ ...actionBtn, background: '#1c5dcf' }}
            disabled={busy}
            onClick={onProgressClick}
          >
            Mulai Kerjakan
          </button>
        )}
        {report.status === 'in_progress' && (
          <button
            style={{ ...actionBtn, background: '#2f9e44' }}
            disabled={busy}
            onClick={onCompleteClick}
          >
            Tandai Selesai
          </button>
        )}
        {(report.status === 'resolved' || report.status === 'rejected') && (
          <span style={{ fontSize: 12, color: '#adb5bd' }}>—</span>
        )}
      </td>
    </tr>
  );
}

function RejectModal({ report, onCancel, onConfirm }) {
  const [reason, setReason] = useState('');
  return (
    <div style={overlay} onClick={onCancel}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Tolak Laporan</h3>
        <p style={{ fontSize: 13, color: '#868e96' }}>
          Jelaskan alasan penolakan laporan ini, akan ditampilkan ke pelapor.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="Contoh: Lokasi di luar wilayah Kabupaten Sidoarjo / foto tidak jelas / laporan duplikat."
          style={textareaStyle}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button style={secondaryBtn} onClick={onCancel}>
            Batal
          </button>
          <button
            style={{ ...actionBtn, background: '#A61C24' }}
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            Tolak Laporan
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Kamera langsung (getUserMedia)                                     */
/* ------------------------------------------------------------------ */
function CameraCapture({ count, max, onCapture, onClose, onUnavailable }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState('environment');
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setReady(false);
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch (err) {
        if (!cancelled) {
          console.warn('[camera]', err.message);
          onUnavailable?.();
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || count >= max) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setFlash(true);
        setTimeout(() => setFlash(false), 160);
        onCapture(new File([blob], `bukti-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.9
    );
  }

  return (
    <div style={cameraBox}>
      <div style={{ position: 'relative', background: '#000' }}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: '100%', maxHeight: 320, display: 'block', objectFit: 'cover' }}
        />
        {!ready && <div style={cameraLoading}>Membuka kamera…</div>}
        {flash && <div style={cameraFlash} />}
        <div style={cameraCounter}>
          {count}/{max}
        </div>
      </div>
      <div style={cameraControls}>
        <button type="button" style={secondaryBtn} onClick={onClose}>
          Selesai
        </button>
        <button
          type="button"
          onClick={capture}
          disabled={!ready || count >= max}
          aria-label="Ambil foto"
          style={{ ...shutterBtn, opacity: !ready || count >= max ? 0.4 : 1 }}
        >
          <span style={shutterInner} />
        </button>
        <button
          type="button"
          style={secondaryBtn}
          onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
        >
          Balik
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Foto bukti perbaikan (maks. 5, kamera + upload)                    */
/* ------------------------------------------------------------------ */
function ProofPhotoPicker({ photos, setPhotos, onBusyChange }) {
  const photosRef = useRef(photos);
  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [photoError, setPhotoError] = useState(null);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  // Bersihkan object URL saat modal ditutup
  useEffect(
    () => () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    },
    []
  );

  useEffect(() => {
    onBusyChange?.(preparing);
  }, [preparing, onBusyChange]);

  const full = photos.length >= MAX_PROOF_PHOTOS;

  async function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    setPhotoError(null);

    const images = incoming.filter((f) => f.type.startsWith('image/'));
    const room = MAX_PROOF_PHOTOS - photosRef.current.length;
    if (room <= 0) {
      setPhotoError(`Maksimal ${MAX_PROOF_PHOTOS} foto. Hapus salah satu untuk menambah foto baru.`);
      return;
    }
    const accepted = images.slice(0, room);
    if (images.length < incoming.length) {
      setPhotoError('Hanya file gambar (JPG, PNG, WebP) yang bisa diunggah.');
    } else if (images.length > room) {
      setPhotoError(`Hanya ${room} foto yang ditambahkan, batas maksimal ${MAX_PROOF_PHOTOS} foto.`);
    }

    setPreparing(true);
    try {
      for (const original of accepted) {
        let prepared = original;
        try {
          prepared = await prepareUploadPhoto(original);
        } catch (err) {
          console.warn('[proof-photo] kompresi dilewati:', err.message);
        }
        if (photosRef.current.length >= MAX_PROOF_PHOTOS) break;
        const item = {
          id: crypto.randomUUID(),
          file: prepared,
          url: URL.createObjectURL(prepared),
        };
        photosRef.current = [...photosRef.current, item];
        setPhotos(photosRef.current);
      }
    } finally {
      setPreparing(false);
    }
  }

  function removePhoto(id) {
    const target = photosRef.current.find((p) => p.id === id);
    if (target) URL.revokeObjectURL(target.url);
    photosRef.current = photosRef.current.filter((p) => p.id !== id);
    setPhotos(photosRef.current);
    setPhotoError(null);
  }

  function handleCameraCapture(file) {
    addFiles([file]);
  }

  // Kalau kamera langsung tidak tersedia (mis. tanpa HTTPS / izin ditolak),
  // pakai kamera bawaan perangkat lewat input capture.
  function handleCameraUnavailable() {
    setCameraOpen(false);
    cameraInputRef.current?.click();
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={fieldLabelRow}>
        <span>Foto bukti perbaikan</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: full ? '#2f9e44' : '#868e96' }}>
          {photos.length}/{MAX_PROOF_PHOTOS}
        </span>
      </div>

      {cameraOpen && (
        <CameraCapture
          count={photos.length}
          max={MAX_PROOF_PHOTOS}
          onCapture={handleCameraCapture}
          onClose={() => setCameraOpen(false)}
          onUnavailable={handleCameraUnavailable}
        />
      )}

      {!cameraOpen && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            style={{ ...pickBtn, ...(full || preparing ? pickBtnDisabled : null) }}
            disabled={full || preparing}
            onClick={() => setCameraOpen(true)}
          >
            <CameraSvg /> Ambil Foto
          </button>
          <button
            type="button"
            style={{ ...pickBtn, ...(full || preparing ? pickBtnDisabled : null) }}
            disabled={full || preparing}
            onClick={() => galleryInputRef.current?.click()}
          >
            <UploadSvg /> Upload
          </button>
        </div>
      )}

      {/* Input tersembunyi */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {photoError && (
        <p role="alert" style={{ fontSize: 12, color: '#e03131', margin: '8px 0 0' }}>
          {photoError}
        </p>
      )}

      {(photos.length > 0 || preparing) && (
        <div style={thumbGrid}>
          {photos.map((p, i) => (
            <div key={p.id} style={thumbItem}>
              <img src={p.url} alt={`Bukti perbaikan ${i + 1}`} style={thumbImg} />
              {i === 0 && <span style={thumbMainBadge}>Utama</span>}
              <button
                type="button"
                onClick={() => removePhoto(p.id)}
                aria-label={`Hapus foto ${i + 1}`}
                style={thumbRemoveBtn}
              >
                ✕
              </button>
            </div>
          ))}
          {preparing && <div style={{ ...thumbItem, ...thumbLoading }}>…</div>}
        </div>
      )}

      {photos.length === 0 && !preparing && (
        <p style={{ fontSize: 11.5, color: '#adb5bd', margin: '8px 0 0' }}>
          Minimal 1 foto, maksimal {MAX_PROOF_PHOTOS}. Ambil langsung dari kamera atau upload dari
          perangkat.
        </p>
      )}
    </div>
  );
}

function CameraSvg() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      aria-hidden="true"
    >
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function UploadSvg() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CompleteModal({ report, onCancel, onConfirm }) {
  const initialItems = report.estimated_materials_json?.length
    ? report.estimated_materials_json
    : [];
  const [items, setItems] = useState(initialItems);
  const [photos, setPhotos] = useState([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [fallbackEstimate, setFallbackEstimate] = useState(null);

  useEffect(() => {
    if (initialItems.length === 0) {
      estimateMaterialsAndCost({
        damageType: report.damage_type,
        hazardScore: report.hazard_score,
        areaPct: report.bbox_area_pct,
      }).then((result) => {
        setItems(result.items);
        if (report.estimated_cost == null) {
          setFallbackEstimate(result);
        }
      });
    }
  }, []);

  function updateItem(index, field, value) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: Number(value) || 0 };
        updated.lineTotal = updated.quantity * updated.unitPrice;
        return updated;
      })
    );
  }

  const total = items.reduce((s, i) => s + i.lineTotal, 0);

  return (
    <div style={overlay} onClick={onCancel}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Tandai Selesai</h3>
        <p style={{ fontSize: 13, color: '#868e96' }}>
          Sesuaikan jumlah & harga jadi material yang <strong>benar-benar dipakai</strong> di
          lapangan. Data ini dipakai untuk melatih estimasi otomatis agar makin akurat ke depannya.
        </p>

        {items.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={materialHeaderRow}>
              <span style={{ flex: 2 }}>Material</span>
              <span style={{ flex: 1, textAlign: 'center' }}>Jumlah</span>
              <span style={{ flex: 1 }}>Satuan</span>
              <span style={{ flex: 1.4, textAlign: 'right' }}>Harga satuan</span>
              <span style={{ flex: 1.4, textAlign: 'right' }}>Subtotal</span>
            </div>
            {items.map((item, i) => (
              <div key={item.name} style={materialRow}>
                <span style={{ flex: 1.5, fontSize: 13 }}>{item.name}</span>
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                  style={{ ...smallInput, flex: 0.8, textAlign: 'center' }}
                />
                <span style={{ flex: 0.8, fontSize: 12, color: '#868e96' }}>{item.unit}</span>
                <div style={{ flex: 1.8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 12, color: '#868e96', flexShrink: 0 }}>Rp</span>
                  <input
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(i, 'unitPrice', e.target.value)}
                    style={{ ...smallInput, textAlign: 'right' }}
                  />
                </div>
                <span style={{ flex: 1.6, fontSize: 13, fontWeight: 600, textAlign: 'right' }}>
                  Rp{item.lineTotal.toLocaleString('id-ID')}
                </span>
              </div>
            ))}
            <div style={totalRow}>
              <span>Total Biaya Aktual</span>
              <span>Rp{total.toLocaleString('id-ID')}</span>
            </div>
            <p style={{ fontSize: 11, color: '#adb5bd', marginTop: 6 }}>
              Kalau ada biaya tenaga kerja/alat, tambahkan sebagai baris "material" tersendiri di
              atas.
            </p>
          </div>
        )}

        <ProofPhotoPicker photos={photos} setPhotos={setPhotos} onBusyChange={setPhotoBusy} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button style={secondaryBtn} onClick={onCancel}>
            Batal
          </button>
          <button
            style={{ ...actionBtn, background: '#2f9e44' }}
            disabled={photos.length === 0 || photoBusy || items.length === 0}
            onClick={() =>
              onConfirm({
                file: photos[0].file,
                files: photos.map((p) => p.file),
                actualMaterials: formatMaterialItems(items),
                actualMaterialsJson: items,
                actualCost: total,
                fallbackEstimatedCost: fallbackEstimate?.totalCost ?? null,
                fallbackEstimatedMaterials: fallbackEstimate
                  ? formatMaterialItems(fallbackEstimate.items)
                  : null,
                fallbackEstimatedMaterialsJson: fallbackEstimate?.items ?? null,
              })
            }
          >
            Simpan & Selesaikan
          </button>
        </div>
      </div>
    </div>
  );
}

function ProgressModal({ report, onCancel, onConfirm }) {
  const [estimate, setEstimate] = useState(null);
  const [items, setItems] = useState([]);
  const [estimatedDate, setEstimatedDate] = useState('');

  useEffect(() => {
    estimateMaterialsAndCost({
      damageType: report.damage_type,
      hazardScore: report.hazard_score,
      areaPct: report.bbox_area_pct,
    }).then((result) => {
      setEstimate(result);
      setItems(result.items);
    });
  }, [report.id]);

  function updateItem(index, field, value) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: Number(value) || 0 };
        updated.lineTotal = updated.quantity * updated.unitPrice;
        return updated;
      })
    );
  }

  const total = items.reduce((s, i) => s + i.lineTotal, 0);

  return (
    <div style={overlay} onClick={onCancel}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Mulai Pengerjaan</h3>

        {!estimate && <p style={{ fontSize: 13, color: '#868e96' }}>Menghitung estimasi…</p>}
        {estimate && (
          <div
            style={{
              ...aiNote,
              background: estimate.isLearned ? '#E6F8EC' : '#FFF8E1',
              color: estimate.isLearned ? '#1c8a4b' : '#8A6D00',
              borderColor: estimate.isLearned ? '#b7e4c7' : '#F0D9A8',
            }}
          >
            {estimate.isLearned ? '📈' : '⚙️'} {estimate.confidenceNote}
          </div>
        )}

        {items.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={materialHeaderRow}>
              <span style={{ flex: 1.5 }}>Material</span>
              <span style={{ flex: 0.8, textAlign: 'center' }}>Jumlah</span>
              <span style={{ flex: 0.8 }}>Satuan</span>
              <span style={{ flex: 1.8, textAlign: 'right' }}>Harga satuan</span>
              <span style={{ flex: 1.6, textAlign: 'right' }}>Subtotal</span>
            </div>
            {items.map((item, i) => (
              <div key={item.name} style={materialRow}>
                <span style={{ flex: 2, fontSize: 13 }}>{item.name}</span>
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                  style={{ ...smallInput, flex: 1, textAlign: 'center' }}
                />
                <span style={{ flex: 1, fontSize: 12, color: '#868e96' }}>{item.unit}</span>
                <div style={{ flex: 1.4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 12, color: '#868e96' }}>Rp</span>
                  <input
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(i, 'unitPrice', e.target.value)}
                    style={{ ...smallInput, textAlign: 'right' }}
                  />
                </div>
                <span style={{ flex: 1.4, fontSize: 13, fontWeight: 600, textAlign: 'right' }}>
                  Rp{item.lineTotal.toLocaleString('id-ID')}
                </span>
              </div>
            ))}
            <div style={totalRow}>
              <span>Total Estimasi</span>
              <span>Rp{total.toLocaleString('id-ID')}</span>
            </div>
            <p style={{ fontSize: 11, color: '#adb5bd', marginTop: 6 }}>
              *Harga material perkiraan pasar umum, belum termasuk tenaga kerja &amp; mobilisasi
              alat.
            </p>
          </div>
        )}

        <label style={fieldLabel}>
          Estimasi tanggal selesai
          <input
            type="date"
            value={estimatedDate}
            onChange={(e) => setEstimatedDate(e.target.value)}
            required
            style={inputStyle}
          />
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button style={secondaryBtn} onClick={onCancel}>
            Batal
          </button>
          <button
            style={{ ...actionBtn, background: '#1c5dcf' }}
            disabled={!estimatedDate || items.length === 0}
            onClick={() =>
              onConfirm({
                estimatedDate,
                materials: formatMaterialItems(items),
                materialsJson: items,
                cost: total,
              })
            }
          >
            Konfirmasi & Mulai Kerjakan
          </button>
        </div>
      </div>
    </div>
  );
}

function getPageWindow(page, totalPages) {
  const size = 5;
  let start = Math.max(0, page - 2);
  const end = Math.min(totalPages, start + size);
  start = Math.max(0, end - size);
  return Array.from({ length: end - start }, (_, i) => start + i);
}

const pagerRow = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 10,
  padding: '14px 20px',
  borderTop: '1px solid #f1f3f5',
};

const pageNumBtn = {
  minWidth: 32,
  height: 32,
  padding: '0 8px',
  borderRadius: 8,
  border: '1px solid #dee2e6',
  background: '#fff',
  color: '#495057',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const pageNumBtnActive = {
  background: '#A61C24',
  borderColor: '#A61C24',
  color: '#fff',
};

const panelCard = {
  marginTop: 20,
  background: '#fff',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(25,27,31,0.06), 0 4px 16px rgba(25,27,31,0.06)',
  overflow: 'visible',
};

const toolbarRow = {
  padding: '16px 20px',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  alignItems: 'center',
};

const searchInputStyle = {
  flex: '1 1 240px',
  padding: '9px 14px',
  borderRadius: 8,
  border: '1px solid #dee2e6',
  fontSize: 13,
  fontFamily: 'inherit',
};

const zoomOverlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.8)',
  zIndex: 2100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
};

const zoomImg = {
  maxWidth: '90vw',
  maxHeight: '90vh',
  borderRadius: 12,
  display: 'block',
};

const zoomCloseBtn = {
  position: 'fixed',
  top: 20,
  right: 20,
  width: 40,
  height: 40,
  borderRadius: '50%',
  border: 'none',
  background: '#fff',
  color: '#333',
  fontSize: 16,
  cursor: 'pointer',
};

const th = {
  padding: '14px 12px',
  fontWeight: 600,
  fontSize: 12.5,
  letterSpacing: 0.3,
  whiteSpace: 'nowrap',
};
const td = { padding: '14px 12px', verticalAlign: 'middle', color: '#343a40' };
const tdNowrap = { ...td, whiteSpace: 'nowrap' };
const dateMain = { fontWeight: 600, color: '#343a40' };
const dateTime = { fontSize: 11.5, color: '#868e96', marginTop: 2 };
const codeText = { fontWeight: 700, color: '#212529', whiteSpace: 'nowrap', fontSize: 12.5 };
const photoLinkBtn = {
  marginTop: 6,
  padding: '4px 0',
  width: 96,
  borderRadius: 6,
  border: '1px solid #dee2e6',
  background: '#fff',
  color: '#A61C24',
  fontSize: 11.5,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const badge = {
  display: 'inline-block',
  whiteSpace: 'nowrap',
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 11.5,
  fontWeight: 700,
};

const actionBtn = {
  padding: '7px 14px',
  borderRadius: 8,
  border: 'none',
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const secondaryBtn = {
  padding: '7px 14px',
  borderRadius: 8,
  border: '1px solid #dee2e6',
  background: '#fff',
  color: '#495057',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: 16,
};

const modal = {
  width: '100%',
  maxWidth: 480,
  background: '#fff',
  borderRadius: 14,
  padding: 24,
  maxHeight: '90vh',
  overflowY: 'auto',
};

const aiNote = {
  fontSize: 12,
  color: '#8A6D00',
  background: '#FFF8E1',
  border: '1px solid #F0D9A8',
  borderRadius: 8,
  padding: '8px 10px',
  marginBottom: 14,
};

const fieldLabel = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 12,
};

const fieldLabelRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 8,
};

const inputStyle = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #dee2e6',
  fontSize: 14,
  fontFamily: 'inherit',
};

const textareaStyle = { ...inputStyle, resize: 'vertical' };

const materialHeaderRow = {
  display: 'flex',
  gap: 8,
  fontSize: 11.5,
  fontWeight: 700,
  color: '#868e96',
  padding: '0 4px 6px',
  borderBottom: '1px solid #eee',
};

const materialRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 4px',
  borderBottom: '1px solid #f5f5f5',
};

const smallInput = {
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid #dee2e6',
  fontSize: 13,
  width: '100%',
  minWidth: 64,
  boxSizing: 'border-box',
};
const totalRow = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 14,
  fontWeight: 800,
  padding: '10px 4px 0',
  marginTop: 4,
};

/* ---------- Foto bukti ---------- */
const pickBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 16px',
  borderRadius: 8,
  border: '1.5px solid #A61C24',
  background: '#fff',
  color: '#A61C24',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

const pickBtnDisabled = {
  opacity: 0.45,
  cursor: 'not-allowed',
};

const thumbGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))',
  gap: 8,
  marginTop: 10,
};

const thumbItem = {
  position: 'relative',
  aspectRatio: '1 / 1',
  borderRadius: 8,
  overflow: 'hidden',
  background: '#f1f3f5',
  border: '1px solid #e9ecef',
};

const thumbImg = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

const thumbLoading = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#adb5bd',
  fontSize: 18,
};

const thumbMainBadge = {
  position: 'absolute',
  left: 4,
  bottom: 4,
  background: 'rgba(0,0,0,0.65)',
  color: '#fff',
  fontSize: 10,
  fontWeight: 700,
  padding: '2px 6px',
  borderRadius: 999,
};

const thumbRemoveBtn = {
  position: 'absolute',
  top: 4,
  right: 4,
  width: 22,
  height: 22,
  borderRadius: '50%',
  border: 'none',
  background: 'rgba(0,0,0,0.65)',
  color: '#fff',
  fontSize: 11,
  lineHeight: 1,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const cameraBox = {
  borderRadius: 12,
  overflow: 'hidden',
  border: '1px solid #dee2e6',
  background: '#fff',
};

const cameraLoading = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  fontSize: 13,
  background: 'rgba(0,0,0,0.5)',
};

const cameraFlash = {
  position: 'absolute',
  inset: 0,
  background: '#fff',
  opacity: 0.8,
  pointerEvents: 'none',
};

const cameraCounter = {
  position: 'absolute',
  top: 8,
  right: 8,
  background: 'rgba(0,0,0,0.6)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  padding: '3px 10px',
  borderRadius: 999,
};

const cameraControls = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 14px',
};

const shutterBtn = {
  width: 56,
  height: 56,
  borderRadius: '50%',
  border: '3px solid #A61C24',
  background: '#fff',
  padding: 3,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const shutterInner = {
  width: '100%',
  height: '100%',
  borderRadius: '50%',
  background: '#A61C24',
  display: 'block',
};

const reportPhotoCss = `
  .report-table tbody tr { transition: background-color 0.15s ease; }
  .report-table tbody tr:hover { background: #fafafa; }
  .report-table td.col-sticky,
  .report-table th.col-sticky-head {
    position: sticky;
    right: 0;
    z-index: 2;
  }
  .report-table td.col-sticky {
    background: #fff;
    box-shadow: -8px 0 8px -8px rgba(0, 0, 0, 0.18);
  }
  .report-table th.col-sticky-head { background: #A61C24; }
  .report-table tbody tr:hover td.col-sticky { background: #fafafa; }
  /* Tabel masih bisa digeser (sentuh / shift+scroll) tapi scrollbar disembunyikan */
  .report-table-wrap { overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; }
  .report-table-wrap::-webkit-scrollbar { display: none; }

  /* Semua filter satu baris */
  .report-toolbar { flex-wrap: nowrap !important; }
  .report-toolbar .rf-search { flex: 1 1 200px !important; min-width: 140px !important; }
  .report-toolbar .rf-item { min-width: 0; }
  .report-toolbar .rf-item > * { width: 100% !important; min-width: 0 !important; box-sizing: border-box; }
  .rf-status { flex: 0 0 150px; }
  .rf-level { flex: 0 0 165px; }
  .rf-kec { flex: 0 0 180px; }
  .rf-date { flex: 0 0 275px; }

  /* Layar sempit: boleh turun baris */
  @media (max-width: 1200px) {
    .report-toolbar { flex-wrap: wrap !important; }
    .report-toolbar .rf-item { flex: 1 1 150px !important; }
  }
  .report-photo-thumb {
    width: 96px;
    height: 64px;
    overflow: hidden;
    border-radius: 8px;
    flex-shrink: 0;
  }

  @media (max-width: 640px) {
    .report-photo-thumb {
      width: 110px;
      height: 110px;
    }
    table { font-size: 12px; }
    th, td { padding: 8px 10px !important; }
  }
`;