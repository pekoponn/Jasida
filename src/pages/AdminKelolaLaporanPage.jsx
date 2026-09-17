import { useEffect, useMemo, useState } from 'react';
import {
  fetchAllReportsForAdmin,
  rejectReport,
  acceptReport,
  startProgress,
  completeReportWithActuals
} from '../lib/reports.js';
import { damageTypeDisplayLabel, severityDisplayLabel } from '../ai/hazardScore.js';
import { estimateMaterialsAndCost, formatMaterialItems } from '../ai/materialEstimate.js';
import { findKecamatan, getKecamatanNames } from '../lib/kecamatanBoundaries.js';
import ZoomableImage from '../components/ZoomableImage.jsx';

const STATUS_LABEL = {
  open: 'Menunggu Verifikasi',
  rejected: 'Ditolak',
  accepted: 'Diterima — Menunggu Dikerjakan',
  in_progress: 'Sedang Dikerjakan',
  resolved: 'Selesai',
  pending_duplicate_review: 'Menunggu Validasi Admin'
};

const STATUS_COLOR = {
  open: { bg: '#FFF3CD', color: '#8A6D00' },
  rejected: { bg: '#FDECEE', color: '#A61C24' },
  accepted: { bg: '#E7F1FF', color: '#1c5dcf' },
  in_progress: { bg: '#E3F1FD', color: '#1c7ed6' },
  resolved: { bg: '#E6F8EC', color: '#1c8a4b' },
  pending_duplicate_review: { bg: '#E7DFFB', color: '#5F3DC4' }
};

const FILTER_TABS = [
  { key: 'all', label: 'Semua' },
  { key: 'open', label: 'Masuk' },
  { key: 'accepted', label: 'Diterima' },
  { key: 'in_progress', label: 'Dikerjakan' },
  { key: 'resolved', label: 'Selesai' },
  { key: 'rejected', label: 'Ditolak' }
];

const SEVERITY_OPTIONS = [
  { key: '', label: 'Semua Tingkat' },
  { key: 'aman', label: 'Aman' },
  { key: 'sedang', label: 'Sedang' },
  { key: 'darurat', label: 'Darurat' }
];

const SEVERITY_COLOR = {
  aman: { bg: '#E6F8EC', color: '#1c8a4b' },
  sedang: { bg: '#FFF3CD', color: '#8A6D00' },
  darurat: { bg: '#FDECEE', color: '#A61C24' }
};

const SEVERITY_ALIAS = {
  medium: 'sedang',
  emergency: 'darurat',
  low: 'aman',
  safe: 'aman'
};

function normalizeSeverity(severity) {
  return SEVERITY_ALIAS[severity] ?? severity;
}

export default function AdminKelolaLaporanPage() {
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
      patchLocal(reportId, { status: 'rejected', rejection_reason: reason, rejected_at: new Date().toISOString() });
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
        estimated_cost: cost
      });
      setProgressTarget(null);
    } catch (err) {
      alert('Gagal memulai pengerjaan: ' + err.message);
    } finally {
      setBusyId(null);
    }
  }
  
  async function handleComplete(reportId, { file, actualMaterials, actualMaterialsJson, actualCost, fallbackEstimatedCost, fallbackEstimatedMaterials, fallbackEstimatedMaterialsJson }) {
    setBusyId(reportId);
    try {
      await completeReportWithActuals(reportId, {
        file, actualMaterials, actualMaterialsJson, actualCost,
        fallbackEstimatedCost, fallbackEstimatedMaterials, fallbackEstimatedMaterialsJson
      });
      patchLocal(reportId, {
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        actual_materials: actualMaterials,
        actual_materials_json: actualMaterialsJson,
        actual_cost: actualCost,
        ...(fallbackEstimatedCost != null ? {
          estimated_cost: fallbackEstimatedCost,
          estimated_materials: fallbackEstimatedMaterials,
          estimated_materials_json: fallbackEstimatedMaterialsJson
        } : {})
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

      if (kecamatanFilter) {
        const nama = typeof r.lat === 'number' && typeof r.lng === 'number'
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
  }, [reports, filter, severityFilter, kecamatanFilter, searchQuery]);

  return (
    <section>
      <h1 className="display" style={{ fontSize: 24, marginBottom: 4 }}>Kelola Laporan</h1>
      <p style={{ color: '#868e96', marginTop: 0, fontSize: 14 }}>
        Proses laporan warga: terima/tolak, jadwalkan pengerjaan, lalu tandai selesai.
      </p>

      {error && <p style={{ color: '#e03131', marginTop: 12 }}>{error}</p>}
      {loading && <p style={{ marginTop: 12 }}>Memuat laporan…</p>}

      {!loading && (
        <div style={panelCard}>
          <div style={toolbarRow}>
            <input
              type="text"
              placeholder="Cari kode laporan atau nama pelapor…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={searchInputStyle}
            />

            <select value={filter} onChange={(e) => setFilter(e.target.value)} style={selectFilterStyle}>
              {FILTER_TABS.map((tab) => (
                <option key={tab.key} value={tab.key}>
                  {tab.label}
                  {tab.key !== 'all' ? ` (${reports.filter((r) => r.status === tab.key).length})` : ''}
                </option>
              ))}
            </select>

            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={selectFilterStyle}>
              {SEVERITY_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>

            <select value={kecamatanFilter} onChange={(e) => setKecamatanFilter(e.target.value)} style={selectFilterStyle}>
              <option value="">Semua Kecamatan</option>
              {kecamatanOptions.map((nama) => (
                <option key={nama} value={nama}>{nama}</option>
              ))}
            </select>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#A61C24', color: '#fff', textAlign: 'left' }}>
                  <th style={th}>Kode</th>
                  <th style={th}>Pelapor</th>
                  <th style={th}>Lokasi</th>
                  <th style={th}>Waktu Lapor</th>
                  <th style={th}>Foto</th>
                  <th style={th}>Kondisi</th>
                  <th style={th}>Status</th>
                  <th style={th}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td style={td} colSpan={7}>Tidak ada laporan.</td></tr>
                )}
                {filtered.map((r) => (
                <RowItem
                    key={r.id}
                    report={r}
                    busy={busyId === r.id}
                    onAccept={() => handleAccept(r)}
                    onRejectClick={() => setRejectTarget(r)}
                    onProgressClick={() => setProgressTarget(r)}
                    onCompleteClick={() => setCompleteTarget(r)}
                    onZoomPhoto={() => setZoomImage(r.imageUrl)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rejectTarget && (
        <RejectModal
          report={rejectTarget}
          onCancel={() => setRejectTarget(null)}
          onConfirm={(reason) => handleReject(rejectTarget.id, reason)}
        />
      )}

      {progressTarget && (
        <ProgressModal
          report={progressTarget}
          onCancel={() => setProgressTarget(null)}
          onConfirm={(payload) => handleStartProgress(progressTarget.id, payload)}
        />
      )}

      {completeTarget && (
        <CompleteModal
          report={completeTarget}
          onCancel={() => setCompleteTarget(null)}
          onConfirm={(payload) => handleComplete(completeTarget.id, payload)}
        />
      )}

      {zoomImage && (
        <div style={zoomOverlay} onClick={() => setZoomImage(null)}>
          <img src={zoomImage} alt="Foto laporan diperbesar" style={zoomImg} onClick={(e) => e.stopPropagation()} />
          <button type="button" style={zoomCloseBtn} onClick={() => setZoomImage(null)} aria-label="Tutup">✕</button>
        </div>
      )}
    </section>
  );
}

function RowItem({ report, busy, onAccept, onRejectClick, onProgressClick, onCompleteClick, onZoomPhoto }) {
  const statusColor = STATUS_COLOR[report.status] ?? STATUS_COLOR.open;
  const normalizedSeverity = normalizeSeverity(report.severity);
  const severityColor = SEVERITY_COLOR[normalizedSeverity] ?? SEVERITY_COLOR.aman;
  const kode = `#${String(report.id).slice(0, 6).toUpperCase()}-JASIDA`;
  const nama = report.profile?.username ?? '-';
  const lokasi = typeof report.lat === 'number' && typeof report.lng === 'number'
    ? (findKecamatan(report.lat, report.lng) ?? '-')
    : '-';

  return (
    <tr style={{ borderBottom: '1px solid #eee' }}>
      <td style={td}>{kode}</td>
      <td style={td}>{nama}</td>
      <td style={td}>{lokasi}</td>
      <td style={td}>{new Date(report.created_at).toLocaleString('id-ID')}</td>
      <td style={td}>
        <ZoomableImage
          src={report.imageUrl}
          alt={damageTypeDisplayLabel(report.damage_type)}
          style={{ width: 150, height: 62, objectFit: 'cover', borderRadius: 8 }}
        />
      </td>
      <td style={td}>
        <div>{damageTypeDisplayLabel(report.damage_type)} · {report.hazard_score}</div>
        {report.severity && (
          <span style={{ ...badge, background: severityColor.bg, color: severityColor.color, marginTop: 4 }}>
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
            Estimasi selesai: {new Date(report.estimated_completion_date).toLocaleDateString('id-ID')}
          </div>
        )}
      </td>
      <td style={td}>
        {report.status === 'open' && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{ ...actionBtn, background: '#2f9e44' }} disabled={busy} onClick={onAccept}>
              Terima
            </button>
            <button style={{ ...actionBtn, background: '#A61C24' }} disabled={busy} onClick={onRejectClick}>
              Tolak
            </button>
          </div>
        )}
        {report.status === 'accepted' && (
          <button style={{ ...actionBtn, background: '#1c5dcf' }} disabled={busy} onClick={onProgressClick}>
            Mulai Kerjakan
          </button>
        )}
        {report.status === 'in_progress' && (
          <button style={{ ...actionBtn, background: '#2f9e44' }} disabled={busy} onClick={onCompleteClick}>
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
          <button style={secondaryBtn} onClick={onCancel}>Batal</button>
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

function CompleteModal({ report, onCancel, onConfirm }) {
  const initialItems = report.estimated_materials_json?.length
    ? report.estimated_materials_json
    : [];
  const [items, setItems] = useState(initialItems);
  const [file, setFile] = useState(null);
  const [fallbackEstimate, setFallbackEstimate] = useState(null);

  useEffect(() => {
    if (initialItems.length === 0) {
      estimateMaterialsAndCost({
        damageType: report.damage_type,
        hazardScore: report.hazard_score,
        areaPct: report.bbox_area_pct
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
          Sesuaikan jumlah & harga jadi material yang <strong>benar-benar dipakai</strong> di lapangan.
          Data ini dipakai untuk melatih estimasi otomatis agar makin akurat ke depannya.
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
              Kalau ada biaya tenaga kerja/alat, tambahkan sebagai baris "material" tersendiri di atas.
            </p>
          </div>
        )}

        <label style={fieldLabel}>
          Foto bukti perbaikan
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={inputStyle}
          />
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button style={secondaryBtn} onClick={onCancel}>Batal</button>
          <button
            style={{ ...actionBtn, background: '#2f9e44' }}
            disabled={!file || items.length === 0}
            onClick={() => onConfirm({
              file,
              actualMaterials: formatMaterialItems(items),
              actualMaterialsJson: items,
              actualCost: total,
              fallbackEstimatedCost: fallbackEstimate?.totalCost ?? null,
              fallbackEstimatedMaterials: fallbackEstimate ? formatMaterialItems(fallbackEstimate.items) : null,
              fallbackEstimatedMaterialsJson: fallbackEstimate?.items ?? null
            })}
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
      areaPct: report.bbox_area_pct
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
          <div style={{ ...aiNote, background: estimate.isLearned ? '#E6F8EC' : '#FFF8E1', color: estimate.isLearned ? '#1c8a4b' : '#8A6D00', borderColor: estimate.isLearned ? '#b7e4c7' : '#F0D9A8' }}>
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
              *Harga material perkiraan pasar umum, belum termasuk tenaga kerja &amp; mobilisasi alat.
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
          <button style={secondaryBtn} onClick={onCancel}>Batal</button>
          <button
            style={{ ...actionBtn, background: '#1c5dcf' }}
            disabled={!estimatedDate || items.length === 0}
            onClick={() => onConfirm({
              estimatedDate,
              materials: formatMaterialItems(items),
              materialsJson: items,
              cost: total
            })}
          >
            Konfirmasi & Mulai Kerjakan
          </button>
        </div>
      </div>
    </div>
  );
}

const panelCard = {
  marginTop: 20,
  background: '#fff',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(25,27,31,0.06), 0 4px 16px rgba(25,27,31,0.06)',
  overflow: 'hidden'
};

const toolbarRow = {
  padding: '16px 20px',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  alignItems: 'center'
};

const searchInputStyle = {
  flex: '1 1 240px',
  padding: '9px 14px',
  borderRadius: 8,
  border: '1px solid #dee2e6',
  fontSize: 13,
  fontFamily: 'inherit'
};

const selectFilterStyle = {
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid #dee2e6',
  fontSize: 13,
  fontFamily: 'inherit',
  background: '#fff',
  color: '#333',
  cursor: 'pointer'
};

const zoomOverlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.8)',
  zIndex: 800,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20
};

const zoomImg = {
  maxWidth: '90vw',
  maxHeight: '90vh',
  borderRadius: 12,
  display: 'block'
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
  cursor: 'pointer'
};

const th = { padding: '12px 16px', fontWeight: 600 };
const td = { padding: '12px 16px', verticalAlign: 'middle' };

const badge = {
  display: 'inline-block',
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 11.5,
  fontWeight: 700
};

const actionBtn = {
  padding: '7px 14px',
  borderRadius: 8,
  border: 'none',
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap'
};

const secondaryBtn = {
  padding: '7px 14px',
  borderRadius: 8,
  border: '1px solid #dee2e6',
  background: '#fff',
  color: '#495057',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer'
};

const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 500,
  padding: 16
};

const modal = {
  width: '100%',
  maxWidth: 480,
  background: '#fff',
  borderRadius: 14,
  padding: 24,
  maxHeight: '90vh',
  overflowY: 'auto'
};

const aiNote = {
  fontSize: 12,
  color: '#8A6D00',
  background: '#FFF8E1',
  border: '1px solid #F0D9A8',
  borderRadius: 8,
  padding: '8px 10px',
  marginBottom: 14
};

const fieldLabel = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, marginBottom: 12 };

const inputStyle = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #dee2e6',
  fontSize: 14,
  fontFamily: 'inherit'
};

const textareaStyle = { ...inputStyle, resize: 'vertical' };

const materialHeaderRow = {
  display: 'flex',
  gap: 8,
  fontSize: 11.5,
  fontWeight: 700,
  color: '#868e96',
  padding: '0 4px 6px',
  borderBottom: '1px solid #eee'
};

const materialRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 4px',
  borderBottom: '1px solid #f5f5f5'
};

const smallInput = {
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid #dee2e6',
  fontSize: 13,
  width: '100%',
  minWidth: 64,
  boxSizing: 'border-box'
};
const totalRow = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 14,
  fontWeight: 800,
  padding: '10px 4px 0',
  marginTop: 4
};
