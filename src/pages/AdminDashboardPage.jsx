import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { FileText, CheckCircle2, Clock3, AlertTriangle } from 'lucide-react';
import { fetchAllReportsForAdmin, updateReportStatus, resolveReport } from '../lib/reports.js';
import { damageTypeDisplayLabel } from '../ai/hazardScore.js';
import AdminMap from '../components/AdminMap.jsx';
import ZoomableImage from '../components/ZoomableImage.jsx';
const CACHE_KEY = 'jasida_geocode_cache_v1';
let geocodeCache;
try {
  geocodeCache = new Map(JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'));
} catch {
  geocodeCache = new Map();
}

function persistGeocodeCache() {
  try {
    const entries = [...geocodeCache.entries()].slice(-1000);
    localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
  } catch {
    // A full/disabled local cache must not prevent the map from loading.
  }
}

let geocodeQueue = Promise.resolve();

function enqueueGeocode(task) {
  const run = geocodeQueue.then(task, task);
  geocodeQueue = run.catch(() => {}).then(() => new Promise((r) => setTimeout(r, 1100)));
  return run;
}

async function reverseGeocode(lat, lng) {
  const key = `${lat},${lng}`;
  if (geocodeCache.has(key)) return geocodeCache.get(key);

  return enqueueGeocode(async () => {
    if (geocodeCache.has(key)) return geocodeCache.get(key);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const addr = data.address ?? {};
      const jalan =
        addr.road ||
        addr.pedestrian ||
        addr.neighbourhood ||
        addr.suburb ||
        data.display_name?.split(',')[0] ||
        null;
      const kelurahan = addr.village || addr.suburb || addr.city_district || '';
      const result = jalan
        ? `${jalan}${kelurahan ? ', ' + kelurahan : ''}`
        : (data.display_name ?? '-');
      geocodeCache.set(key, result);
      persistGeocodeCache();
      return result;
    } catch (err) {
      console.warn('[reverse-geocode]', err.message);
      return '-';
    }
  });
}

export const STATUS_LABEL = {
  open: 'Belum Diproses',
  rejected: 'Ditolak',
  accepted: 'Menunggu Dikerjakan',
  in_progress: 'Diproses',
  resolved: 'Selesai',
  pending_duplicate_review: 'Menunggu Validasi Admin',
};

export const SEVERITY_STYLE = {
  aman: { color: '#2f9e44', label: 'Aman' },
  low: { color: '#2f9e44', label: 'Aman' },
  sedang: { color: '#f08c00', label: 'Sedang' },
  medium: { color: '#f08c00', label: 'Sedang' },
  high: { color: '#e8590c', label: 'Tinggi' },
  darurat: { color: '#e03131', label: 'Darurat' },
  emergency: { color: '#e03131', label: 'Darurat' },
};

const DONUT_COLORS = ['#2f9e44', '#f5c518', '#e03131'];

export default function AdminDashboardPage() {
  const location = useLocation();
  const view = location.pathname.endsWith('/peta') ? 'map' : 'list';

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllReportsForAdmin({ statusFilter: 'all' });
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
      setReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, status: newStatus } : r)));
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
    const c = { open: 0, in_progress: 0, resolved: 0, darurat: 0 };
    reports.forEach((r) => {
      if (c[r.status] !== undefined) c[r.status]++;
      if (r.severity === 'darurat' || r.severity === 'emergency') c.darurat++;
    });
    return c;
  }, [reports]);

  function weekOverWeek(filterFn) {
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const thisWeek = reports.filter(
      (r) => filterFn(r) && now - new Date(r.created_at).getTime() <= oneWeek
    ).length;
    const lastWeek = reports.filter((r) => {
      const age = now - new Date(r.created_at).getTime();
      return filterFn(r) && age > oneWeek && age <= 2 * oneWeek;
    }).length;
    if (lastWeek === 0) return null;
    return Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  }

  const trendPct = useMemo(
    () => ({
      total: weekOverWeek(() => true),
      resolved: weekOverWeek((r) => r.status === 'resolved'),
      open: weekOverWeek((r) => r.status === 'open'),
      darurat: weekOverWeek((r) => r.severity === 'darurat' || r.severity === 'emergency'),
    }),
    [reports]
  );

  const trendData = useMemo(() => {
    const byDay = {};
    reports.forEach((r) => {
      const day = new Date(r.created_at).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
      });
      if (!byDay[day]) byDay[day] = { day, masuk: 0, selesai: 0 };
      byDay[day].masuk++;
      if (r.status === 'resolved') byDay[day].selesai++;
    });
    return Object.values(byDay).slice(-30);
  }, [reports]);

  const severityBuckets = useMemo(() => {
    const buckets = [
      { key: 'ringan', label: 'Ringan (0–35)', min: 0, max: 35, count: 0 },
      { key: 'sedang', label: 'Sedang (36–75)', min: 36, max: 75, count: 0 },
      { key: 'parah', label: 'Parah (75–100)', min: 76, max: 100, count: 0 },
    ];
    reports.forEach((r) => {
      const score = r.hazard_score ?? 0;
      const b = buckets.find((b) => score >= b.min && score <= b.max);
      if (b) b.count++;
    });
    return buckets;
  }, [reports]);

  return (
    <section>
      <h1 className="display" style={{ fontSize: 24, marginBottom: 4 }}>
        Dashboard Admin
      </h1>
      <p style={{ color: 'var(--color-ink-soft)', marginTop: 0, fontSize: 14 }}>
        Pantau dan proses laporan kerusakan jalan dari warga.
      </p>

      {error && <p style={{ color: 'var(--sev-emergency)', marginTop: 12 }}>{error}</p>}
      {loading && <p style={{ marginTop: 12 }}>Memuat laporan…</p>}

      {!loading && view === 'map' && <AdminMap reports={reports} />}

      {!loading && view === 'list' && (
        <>
          <div style={summaryGrid}>
            <SummaryCard
              icon={<FileText size={22} color="#2f9e44" />}
              iconBg="#E7F6EC"
              label="Total Laporan Masuk"
              value={reports.length}
              trend={trendPct.total}
            />
            <SummaryCard
              icon={<CheckCircle2 size={22} color="#f08c00" />}
              iconBg="#FDF1DE"
              label="Laporan Selesai"
              value={counts.resolved}
              trend={trendPct.resolved}
            />
            <SummaryCard
              icon={<Clock3 size={22} color="#1c7ed6" />}
              iconBg="#E3F1FD"
              label="Menunggu Verifikasi"
              value={counts.open}
              trend={trendPct.open}
              invert
            />
            <SummaryCard
              icon={<AlertTriangle size={22} color="#e03131" />}
              iconBg="#FBE3E3"
              label="Laporan Darurat"
              value={counts.darurat}
              trend={trendPct.darurat}
            />
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
            <div style={{ ...panelCard, flex: '2 1 420px', marginTop: 0 }}>
              <h3 style={panelTitle}>Statistik Laporan</h3>
              {trendData.length > 0 ? (
                <div style={{ height: 240, marginTop: 10 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="day" fontSize={11} />
                      <YAxis allowDecimals={false} fontSize={11} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="masuk"
                        name="Masuk"
                        stroke="#e03131"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="selesai"
                        name="Selesai"
                        stroke="#2f9e44"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p style={{ color: 'var(--color-ink-soft)', fontSize: 13, marginTop: 10 }}>
                  Belum ada data laporan.
                </p>
              )}
            </div>

            <div style={{ ...panelCard, flex: '1 1 300px', marginTop: 0 }}>
              <h3 style={panelTitle}>Laporan Berdasarkan Tingkat Kerusakan</h3>
              {reports.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10 }}>
                  <div style={{ width: 140, height: 140, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={severityBuckets}
                          dataKey="count"
                          innerRadius={38}
                          outerRadius={65}
                          paddingAngle={2}
                        >
                          {severityBuckets.map((b, i) => (
                            <Cell key={b.key} fill={DONUT_COLORS[i]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {severityBuckets.map((b, i) => {
                      const pct = reports.length ? Math.round((b.count / reports.length) * 100) : 0;
                      return (
                        <div
                          key={b.key}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
                        >
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: DONUT_COLORS[i],
                            }}
                          />
                          <span style={{ minWidth: 110 }}>{b.label}</span>
                          <strong>
                            {b.count} ({pct}%)
                          </strong>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p style={{ color: 'var(--color-ink-soft)', fontSize: 13, marginTop: 10 }}>
                  Belum ada data.
                </p>
              )}
            </div>
          </div>

          <div style={{ ...panelCard, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px' }}>
              <h3 style={{ ...panelTitle, margin: 0 }}>Kelola Laporan</h3>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr
                    style={{
                      background: '#A61C24',
                      color: '#fff',
                      textAlign: 'left',
                      position: 'sticky',
                      top: 0,
                      zIndex: 10,
                    }}
                  >
                    <th style={th}>Kode</th>
                    <th style={th}>Nama Pelapor</th>
                    <th style={th}>Lokasi</th>
                    <th style={th}>Long</th>
                    <th style={th}>Lat</th>
                    <th style={th}>Waktu Lapor</th>
                    <th style={th}>Foto</th>
                    <th style={th}>Kondisi</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.length === 0 && (
                    <tr>
                      <td style={td} colSpan={9}>
                        Tidak ada laporan.
                      </td>
                    </tr>
                  )}
                  {reports.map((r) => (
                    <ReportRowTable
                      key={r.id}
                      report={r}
                      updating={updatingId === r.id}
                      onStatusChange={handleStatusChange}
                      onResolve={handleResolve}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function SummaryCard({ icon, iconBg, label, value, trend, invert }) {
  const isUp = trend > 0;
  const goodColor = invert ? '#e03131' : '#2f9e44';
  const badColor = invert ? '#2f9e44' : '#e03131';
  return (
    <div style={summaryCard}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 10,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-ink-soft)' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, marginTop: 2 }}>
        {value.toLocaleString('id-ID')}
      </div>
      {trend !== null && trend !== undefined && (
        <div style={{ fontSize: 12, marginTop: 6, color: isUp ? goodColor : badColor }}>
          {isUp ? '↑' : '↓'} {Math.abs(trend)}% dari minggu lalu
        </div>
      )}
    </div>
  );
}

function ReportRowTable({ report, updating, onStatusChange, onResolve }) {
  const style = SEVERITY_STYLE[report.severity] ?? { color: '#868e96', label: report.severity };
  const kode = report.code ?? `#${String(report.id).slice(0, 6).toUpperCase()}-JASIDA`;
  const nama = report.reporter_name ?? report.profile?.username ?? '-';
  const long = report.lng ?? report.longitude ?? '-';
  const lat = report.lat ?? report.latitude ?? '-';

  const [lokasi, setLokasi] = useState(report.address ?? report.location_text ?? null);

  useEffect(() => {
    if (lokasi || lat === '-' || long === '-') return;
    let cancelled = false;
    reverseGeocode(lat, long).then((result) => {
      if (!cancelled) setLokasi(result);
    });
    return () => {
      cancelled = true;
    };
  }, [lat, long]);

  return (
    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
      <td style={td}>{kode}</td>
      <td style={td}>{nama}</td>
      <td style={td}>{lokasi ?? 'Memuat lokasi…'}</td>
      <td style={td}>{long}</td>
      <td style={td}>{lat}</td>
      <td style={td}>{new Date(report.created_at).toLocaleString('id-ID')}</td>
      <td style={td}>
        <ZoomableImage
          src={report.imageUrl}
          alt={damageTypeDisplayLabel(report.damage_type)}
          style={{
            width: 56,
            height: 56,
            minWidth: 56,
            objectFit: 'cover',
            objectPosition: 'center',
            borderRadius: 6,
            display: 'block',
          }}
        />
      </td>
      <td style={td}>
        <span style={{ ...badge, background: style.color }}>
          {style.label} · {report.hazard_score}
        </span>
      </td>
      <td style={td}>{STATUS_LABEL[report.status] ?? report.status}</td>
    </tr>
  );
}

const badge = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 999,
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
};

const summaryGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 16,
  marginTop: 20,
};

const summaryCard = {
  padding: '18px 20px',
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-card)',
};

const panelCard = {
  marginTop: 16,
  padding: 16,
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-card)',
};

const panelTitle = { fontSize: 15, fontWeight: 700, margin: 0 };

const th = { padding: '12px 16px', fontWeight: 600 };
const td = { padding: '12px 16px', verticalAlign: 'middle' };
