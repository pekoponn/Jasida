import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchAllReportsForAdmin, updateReportStatus, resolveReport } from '../lib/reports.js';
import { damageTypeDisplayLabel } from '../ai/hazardScore.js';
import AdminMap from '../components/AdminMap.jsx';

export const STATUS_LABEL = {
  open: 'Belum Diproses',
  in_progress: 'Diproses',
  resolved: 'Selesai'
};

export const SEVERITY_STYLE = {
  aman: { color: '#2f9e44', label: 'Aman' },
  low: { color: '#2f9e44', label: 'Aman' },
  sedang: { color: '#f08c00', label: 'Sedang' },
  medium: { color: '#f08c00', label: 'Sedang' },
  high: { color: '#e8590c', label: 'Tinggi' },
  darurat: { color: '#e03131', label: 'Darurat' },
  emergency: { color: '#e03131', label: 'Darurat' }
};

export default function AdminDashboardPage() {
  const location = useLocation();
  const view = location.pathname.endsWith('/peta') ? 'map' : 'list';

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    load();
  }, [statusFilter]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllReportsForAdmin({ statusFilter });
      setReports(data);
    } catch (err) {
      console.error(err);
      setError('Gagal memuat laporan: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(report, newStatus) {
    setUpdatingId(report.id);
    try {
      await updateReportStatus(report.id, newStatus);
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, status: newStatus } : r))
      );
    } catch (err) {
      console.error(err);
      alert('Gagal update status: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleResolve(report, file) {
    setUpdatingId(report.id);
    try {
      await resolveReport(report.id, file);
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, status: 'resolved' } : r))
      );
    } catch (err) {
      console.error(err);
      alert('Gagal menandai selesai: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  const counts = useMemo(() => {
    const c = { open: 0, in_progress: 0, resolved: 0 };
    reports.forEach((r) => { if (c[r.status] !== undefined) c[r.status]++; });
    return c;
  }, [reports]);

  const severityCounts = useMemo(() => {
    const c = {};
    reports.forEach((r) => {
      const style = SEVERITY_STYLE[r.severity];
      const label = style?.label ?? r.severity ?? 'Lainnya';
      c[label] = (c[label] ?? 0) + 1;
    });
    return c;
  }, [reports]);

  const trendData = useMemo(() => {
    const byDay = {};
    reports.forEach((r) => {
      const day = new Date(r.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      byDay[day] = (byDay[day] ?? 0) + 1;
    });
    return Object.entries(byDay)
      .map(([day, count]) => ({ day, count }))
      .slice(-30);
  }, [reports]);

  return (
    <section>
      <h1 className="display" style={{ fontSize: 24, marginBottom: 4 }}>Dashboard Admin</h1>
      <p style={{ color: 'var(--color-ink-soft)', marginTop: 0, fontSize: 14 }}>
        Pantau dan proses laporan kerusakan jalan dari warga.
      </p>

      {view === 'list' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {['all', 'open', 'in_progress', 'resolved'].map((s) => (
            <button key={s} style={filterBtn(statusFilter === s)} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'Semua' : STATUS_LABEL[s]}
              {s !== 'all' && ` (${counts[s] ?? 0})`}
            </button>
          ))}
        </div>
      )}

      {error && <p style={{ color: 'var(--sev-emergency)', marginTop: 12 }}>{error}</p>}
      {loading && <p style={{ marginTop: 12 }}>Memuat laporan…</p>}

      {!loading && view === 'map' && (
        <>
          <div style={summaryGrid}>
            <SummaryCard label="Total laporan" value={reports.length} />
            <SummaryCard label="Belum diproses" value={counts.open} />
            <SummaryCard label="Sedang diproses" value={counts.in_progress} />
            <SummaryCard label="Selesai" value={counts.resolved} />
          </div>

          <div style={panelCard}>
            <h3 style={panelTitle}>Sebaran tingkat keparahan</h3>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
              {Object.entries(severityCounts).map(([label, count]) => (
                <div key={label} style={{ fontSize: 13 }}>
                  <span style={{ fontWeight: 700 }}>{count}</span>{' '}
                  <span style={{ color: 'var(--color-ink-soft)' }}>{label}</span>
                </div>
              ))}
              {reports.length === 0 && <p style={{ color: 'var(--color-ink-soft)', fontSize: 13 }}>Belum ada data.</p>}
            </div>
          </div>

          <div style={panelCard}>
            <h3 style={panelTitle}>Tren laporan masuk</h3>
            {trendData.length > 0 ? (
              <div style={{ height: 220, marginTop: 10 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="day" fontSize={11} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p style={{ color: 'var(--color-ink-soft)', fontSize: 13, marginTop: 10 }}>Belum ada data laporan.</p>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <AdminMap reports={reports} />
          </div>
        </>
      )}

      {!loading && view === 'list' && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reports.length === 0 && <p style={{ color: 'var(--color-ink-soft)' }}>Tidak ada laporan.</p>}
          {reports.map((r) => (
            <ReportRow
              key={r.id}
              report={r}
              updating={updatingId === r.id}
              onStatusChange={handleStatusChange}
              onResolve={handleResolve}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div style={summaryCard}>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--color-ink-soft)' }}>{label}</div>
    </div>
  );
}

function ReportRow({ report, updating, onStatusChange, onResolve }) {
  const style = SEVERITY_STYLE[report.severity] ?? { color: '#868e96', label: report.severity };
  const [resolving, setResolving] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function cancelResolve() {
    setResolving(false);
    setFile(null);
    setPreview(null);
  }

  async function submitResolve() {
    if (!file) return;
    await onResolve(report, file);
    setResolving(false);
    setFile(null);
    setPreview(null);
  }

  return (
    <div style={rowCard}>
      <div style={{ display: 'flex', gap: 12 }}>
        {report.imageUrl && (
          <img
            src={report.imageUrl}
            alt={damageTypeDisplayLabel(report.damage_type)}
            style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 'var(--radius-md)', flexShrink: 0 }}
          />
        )}

        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700 }}>{damageTypeDisplayLabel(report.damage_type)}</div>
            <div style={{ fontSize: 12, color: 'var(--color-ink-soft)', marginTop: 2 }}>
              {new Date(report.created_at).toLocaleString('id-ID')}
            </div>
            {report.note && (
              <div style={{ fontSize: 13, marginTop: 6, fontStyle: 'italic' }}>"{report.note}"</div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ ...badge, background: style.color }}>{style.label} · {report.hazard_score}</span>
            <div style={{ fontSize: 12, color: 'var(--color-ink-soft)', marginTop: 6 }}>
              {STATUS_LABEL[report.status] ?? report.status}
            </div>
          </div>
        </div>
      </div>

      {!resolving && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {report.status !== 'in_progress' && report.status !== 'resolved' && (
            <button
              style={actionBtn}
              disabled={updating}
              onClick={() => onStatusChange(report, 'in_progress')}
            >
              Mulai Proses
            </button>
          )}
          {report.status !== 'resolved' && (
            <button
              style={{ ...actionBtn, background: '#2f9e44' }}
              disabled={updating}
              onClick={() => setResolving(true)}
            >
              Tandai Selesai
            </button>
          )}
          {report.status === 'resolved' && (
            <button
              style={{ ...actionBtn, background: '#868e96' }}
              disabled={updating}
              onClick={() => onStatusChange(report, 'open')}
            >
              Buka Kembali
            </button>
          )}
        </div>
      )}

      {resolving && (
        <div style={resolveBox}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>
            Unggah foto bukti perbaikan sebelum menandai selesai
          </p>

          {preview ? (
            <img src={preview} alt="Preview bukti perbaikan" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: 10 }} />
          ) : (
            <label style={fileLabel}>
              📷 Pilih foto bukti perbaikan
              <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
            </label>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              style={{ ...actionBtn, background: '#2f9e44', opacity: file ? 1 : 0.5 }}
              disabled={!file || updating}
              onClick={submitResolve}
            >
              {updating ? 'Mengirim…' : 'Kirim & Tandai Selesai'}
            </button>
            <button
              style={{ ...actionBtn, background: '#868e96' }}
              disabled={updating}
              onClick={cancelResolve}
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const filterBtn = (active) => ({
  padding: '6px 12px', borderRadius: 999,
  border: '1px solid var(--color-border)',
  background: active ? 'var(--color-ink)' : 'transparent',
  color: active ? '#fff' : 'inherit',
  fontSize: 13
});

const rowCard = {
  padding: 14, background: 'var(--color-surface)',
  borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)'
};

const badge = {
  display: 'inline-block', padding: '3px 10px', borderRadius: 999,
  color: '#fff', fontSize: 12, fontWeight: 700
};

const actionBtn = {
  padding: '8px 14px', borderRadius: 'var(--radius-md)', border: 'none',
  background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600
};

const resolveBox = {
  marginTop: 12,
  padding: 12,
  background: 'var(--color-bg)',
  borderRadius: 'var(--radius-md)'
};

const fileLabel = {
  display: 'block',
  padding: '20px 12px',
  textAlign: 'center',
  border: '1.5px dashed var(--color-border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--color-ink-soft)',
  cursor: 'pointer'
};

const summaryGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: 10,
  marginTop: 16
};

const summaryCard = {
  padding: '14px 16px',
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-card)'
};

const panelCard = {
  marginTop: 16,
  padding: 16,
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-card)'
};

const panelTitle = { fontSize: 15, fontWeight: 700, margin: 0 };