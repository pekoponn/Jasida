import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  FileText,
  CheckCircle2,
  Clock3,
  AlertTriangle,
} from 'lucide-react';
import { fetchAllReportsForAdmin } from '../lib/reports.js';
import { damageTypeDisplayLabel, DAMAGE_TYPE_LABEL_ID } from '../ai/hazardScore.js';

const DAMAGE_COLORS = [
  '#e03131',
  '#f08c00',
  '#2f9e44',
  '#1c7ed6',
  '#845ef7',
  '#e64980',
  '#20c997',
  '#868e96',
];

function formatRupiah(n) {
  if (n == null) return '-';
  return 'Rp' + Math.round(n).toLocaleString('id-ID');
}

export default function AdminStatistikPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      setError('Gagal memuat data statistik: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Status laporan (sama seperti Dashboard): Baru/Diproses/Selesai/Darurat
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

  // Tren laporan harian (30 hari terakhir) — sama seperti chart di Dashboard
  const dailyTrend = useMemo(() => {
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

  // Distribusi tingkat kerusakan berdasarkan hazard_score — sama seperti donut di Dashboard
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

  const SEVERITY_DONUT_COLORS = ['#2f9e44', '#f5c518', '#e03131'];

  // Ringkasan biaya: total estimasi vs total aktual
  const costSummary = useMemo(() => {
    let totalEstimasi = 0;
    let totalAktual = 0;
    let countEstimasi = 0;
    let countAktual = 0;

    reports.forEach((r) => {
      if (r.estimated_cost != null) {
        totalEstimasi += r.estimated_cost;
        countEstimasi++;
      }
      if (r.actual_cost != null) {
        totalAktual += r.actual_cost;
        countAktual++;
      }
    });

    const selisih = totalAktual - totalEstimasi;
    const selisihPct = totalEstimasi ? Math.round((selisih / totalEstimasi) * 100) : null;

    return { totalEstimasi, totalAktual, selisih, selisihPct, countEstimasi, countAktual };
  }, [reports]);

  // Tren jumlah laporan & biaya per bulan
  const monthlyTrend = useMemo(() => {
    const byMonth = {};
    reports.forEach((r) => {
      const d = new Date(r.created_at);
      const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
      if (!byMonth[sortKey])
        byMonth[sortKey] = { sortKey, label, masuk: 0, selesai: 0, estimasi: 0, aktual: 0 };
      byMonth[sortKey].masuk++;
      if (r.status === 'resolved') {
        byMonth[sortKey].selesai++;
        byMonth[sortKey].estimasi += r.estimated_cost ?? 0;
        byMonth[sortKey].aktual += r.actual_cost ?? 0;
      }
    });
    return Object.values(byMonth)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-12);
  }, [reports]);

  // Statistik per jenis kerusakan: jumlah laporan + total estimasi/aktual
  // Semua jenis kerusakan yang dikenali sistem ikut ditampilkan, walau 0 laporan,
  // supaya persentase tiap jenis (mis. Retak Buaya) tetap terlihat jelas.
  const damageTypeStats = useMemo(() => {
    const raw = {};
    Object.keys(DAMAGE_TYPE_LABEL_ID).forEach((key) => {
      raw[key] = { damage_type: key, count: 0, estimasi: 0, aktual: 0 };
    });
    reports.forEach((r) => {
      const key = r.damage_type ?? 'lainnya';
      if (!raw[key]) raw[key] = { damage_type: key, count: 0, estimasi: 0, aktual: 0 };
      raw[key].count++;
      raw[key].estimasi += r.estimated_cost ?? 0;
      raw[key].aktual += r.actual_cost ?? 0;
    });
    return Object.values(raw)
      .map((d) => ({ ...d, label: damageTypeDisplayLabel(d.damage_type) }))
      .sort((a, b) => b.count - a.count);
  }, [reports]);

  // Laporan selesai dengan data biaya, untuk tabel rincian
  const resolvedWithCost = useMemo(() => {
    return reports
      .filter((r) => r.status === 'resolved' && (r.estimated_cost != null || r.actual_cost != null))
      .sort(
        (a, b) => new Date(b.resolved_at ?? b.created_at) - new Date(a.resolved_at ?? a.created_at)
      );
  }, [reports]);

  return (
    <section>
      <h1 className="display" style={{ fontSize: 24, marginBottom: 4 }}>
        Statistik
      </h1>
      <p style={{ color: 'var(--color-ink-soft)', marginTop: 0, fontSize: 14 }}>
        Ringkasan performa laporan dan perbandingan biaya estimasi dengan biaya aktual.
      </p>

      {error && <p style={{ color: 'var(--sev-emergency)', marginTop: 12 }}>{error}</p>}
      {loading && <p style={{ marginTop: 12 }}>Memuat statistik…</p>}

      {!loading && (
        <>
          {/* RINGKASAN BIAYA */}
          <div style={summaryGrid}>
            <SummaryCard
              icon={<FileText size={22} color="#1c7ed6" />}
              iconBg="#E3F1FD"
              label="Total Laporan"
              value={reports.length.toLocaleString('id-ID')}
            />
            <SummaryCard
              icon={<Wallet size={22} color="#f08c00" />}
              iconBg="#FDF1DE"
              label="Total Estimasi Biaya"
              value={formatRupiah(costSummary.totalEstimasi)}
              sub={`${costSummary.countEstimasi} laporan`}
            />
            <SummaryCard
              icon={<Wallet size={22} color="#2f9e44" />}
              iconBg="#E7F6EC"
              label="Total Biaya Aktual"
              value={formatRupiah(costSummary.totalAktual)}
              sub={`${costSummary.countAktual} laporan`}
            />
            <SummaryCard
              icon={
                costSummary.selisih > 0 ? (
                  <TrendingUp size={22} color="#e03131" />
                ) : (
                  <TrendingDown size={22} color="#2f9e44" />
                )
              }
              iconBg={costSummary.selisih > 0 ? '#FBE3E3' : '#E7F6EC'}
              label="Selisih Biaya"
              value={`${costSummary.selisih > 0 ? '+' : ''}${formatRupiah(costSummary.selisih)}`}
              sub={
                costSummary.selisihPct != null
                  ? `${costSummary.selisihPct > 0 ? '+' : ''}${costSummary.selisihPct}% dari estimasi`
                  : 'Belum ada data'
              }
              valueColor={costSummary.selisih > 0 ? '#e03131' : '#2f9e44'}
            />
          </div>

          {/* RINGKASAN STATUS (sama seperti di Dashboard) */}
          <div style={{ ...summaryGrid, marginTop: 12 }}>
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
              invertTrend
            />
            <SummaryCard
              icon={<AlertTriangle size={22} color="#e03131" />}
              iconBg="#FBE3E3"
              label="Laporan Darurat"
              value={counts.darurat}
              trend={trendPct.darurat}
            />
          </div>

          {/* TREN HARIAN + DISTRIBUSI TINGKAT KERUSAKAN (sama seperti di Dashboard) */}
          <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
            <div style={{ ...panelCard, flex: '2 1 420px', marginTop: 0 }}>
              <h3 style={panelTitle}>Tren Laporan Harian (30 Hari Terakhir)</h3>
              {dailyTrend.length > 0 ? (
                <div style={{ height: 240, marginTop: 10 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="day" fontSize={11} />
                      <YAxis allowDecimals={false} fontSize={11} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
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
                            <Cell key={b.key} fill={SEVERITY_DONUT_COLORS[i]} />
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
                              background: SEVERITY_DONUT_COLORS[i],
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

          {/* ESTIMASI VS AKTUAL PER BULAN */}
          <div style={panelCard}>
            <h3 style={panelTitle}>Estimasi vs Aktual Biaya per Bulan</h3>
            {monthlyTrend.some((m) => m.estimasi > 0 || m.aktual > 0) ? (
              <div style={{ height: 260, marginTop: 10 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}rb`} />
                    <Tooltip formatter={(value) => formatRupiah(value)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="estimasi" name="Estimasi" fill="#f08c00" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="aktual" name="Aktual" fill="#2f9e44" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p style={{ color: 'var(--color-ink-soft)', fontSize: 13, marginTop: 10 }}>
                Belum ada laporan selesai dengan data biaya.
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {/* DISTRIBUSI JENIS KERUSAKAN */}
            <div style={{ ...panelCard, flex: '1 1 340px' }}>
              <h3 style={panelTitle}>Distribusi Jenis Kerusakan Jalan</h3>
              {damageTypeStats.length > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    marginTop: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ width: 150, height: 150, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={damageTypeStats}
                          dataKey="count"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                        >
                          {damageTypeStats.map((d, i) => (
                            <Cell
                              key={d.damage_type}
                              fill={DAMAGE_COLORS[i % DAMAGE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 140 }}>
                    {damageTypeStats.map((d, i) => {
                      const pct = reports.length ? Math.round((d.count / reports.length) * 100) : 0;
                      return (
                        <div
                          key={d.damage_type}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}
                        >
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: DAMAGE_COLORS[i % DAMAGE_COLORS.length],
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ flex: 1 }}>{d.label}</span>
                          <strong>
                            {d.count} ({pct}%)
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

            {/* BIAYA PER JENIS KERUSAKAN */}
            <div style={{ ...panelCard, flex: '2 1 420px', padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 16px 0' }}>
                <h3 style={panelTitle}>Estimasi vs Aktual per Jenis Kerusakan</h3>
              </div>
              <div style={{ overflowX: 'auto', marginTop: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#A61C24', color: '#fff', textAlign: 'left' }}>
                      <th style={th}>Jenis Kerusakan</th>
                      <th style={th}>Jumlah</th>
                      <th style={th}>Estimasi</th>
                      <th style={th}>Aktual</th>
                      <th style={th}>Selisih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {damageTypeStats.map((d) => {
                      const selisih = d.aktual - d.estimasi;
                      const hasBoth = d.estimasi > 0 && d.aktual > 0;
                      return (
                        <tr
                          key={d.damage_type}
                          style={{ borderBottom: '1px solid var(--color-border)' }}
                        >
                          <td style={td}>{d.label}</td>
                          <td style={td}>{d.count}</td>
                          <td style={td}>{d.estimasi > 0 ? formatRupiah(d.estimasi) : '-'}</td>
                          <td style={td}>{d.aktual > 0 ? formatRupiah(d.aktual) : '-'}</td>
                          <td
                            style={{
                              ...td,
                              fontWeight: 700,
                              color: hasBoth ? (selisih > 0 ? '#e03131' : '#2f9e44') : 'inherit',
                            }}
                          >
                            {hasBoth ? `${selisih > 0 ? '+' : ''}${formatRupiah(selisih)}` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* RINCIAN BIAYA PER LAPORAN */}
          <div style={{ ...panelCard, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px' }}>
              <h3 style={{ ...panelTitle, margin: 0 }}>Rincian Biaya Laporan Selesai</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#A61C24', color: '#fff', textAlign: 'left' }}>
                    <th style={th}>Kode</th>
                    <th style={th}>Jenis Kerusakan</th>
                    <th style={th}>Tanggal Selesai</th>
                    <th style={th}>Estimasi</th>
                    <th style={th}>Aktual</th>
                    <th style={th}>Selisih</th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedWithCost.length === 0 && (
                    <tr>
                      <td style={td} colSpan={6}>
                        Belum ada laporan selesai dengan data biaya.
                      </td>
                    </tr>
                  )}
                  {resolvedWithCost.map((r) => {
                    const kode = r.code ?? `#${String(r.id).slice(0, 6).toUpperCase()}-JASIDA`;
                    const selisih = (r.actual_cost ?? 0) - (r.estimated_cost ?? 0);
                    const hasBoth = r.estimated_cost != null && r.actual_cost != null;
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={td}>{kode}</td>
                        <td style={td}>{damageTypeDisplayLabel(r.damage_type)}</td>
                        <td style={td}>
                          {r.resolved_at
                            ? new Date(r.resolved_at).toLocaleDateString('id-ID')
                            : '-'}
                        </td>
                        <td style={td}>{formatRupiah(r.estimated_cost)}</td>
                        <td style={td}>{formatRupiah(r.actual_cost)}</td>
                        <td
                          style={{
                            ...td,
                            color: hasBoth ? (selisih > 0 ? '#e03131' : '#2f9e44') : 'inherit',
                            fontWeight: 700,
                          }}
                        >
                          {hasBoth ? `${selisih > 0 ? '+' : ''}${formatRupiah(selisih)}` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function SummaryCard({ icon, iconBg, label, value, sub, valueColor, trend, invertTrend }) {
  const isUp = trend > 0;
  const goodColor = invertTrend ? '#e03131' : '#2f9e44';
  const badColor = invertTrend ? '#2f9e44' : '#e03131';
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
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, color: valueColor ?? 'inherit' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, marginTop: 4, color: 'var(--color-ink-soft)' }}>{sub}</div>
      )}
      {trend !== null && trend !== undefined && (
        <div style={{ fontSize: 12, marginTop: 6, color: isUp ? goodColor : badColor }}>
          {isUp ? '↑' : '↓'} {Math.abs(trend)}% dari minggu lalu
        </div>
      )}
    </div>
  );
}

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
