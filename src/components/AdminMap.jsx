import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { MapPin, AlertTriangle, Gauge, CircleSlash } from 'lucide-react';
import { damageTypeDisplayLabel } from '../ai/hazardScore.js';
import { SEVERITY_STYLE } from '../pages/AdminDashboardPage.jsx';
import { findKecamatan, getKecamatanGeoJSON } from '../lib/kecamatanBoundaries.js';

const STATUS_LABEL = {
  open: 'Baru',
  accepted: 'Diterima',
  in_progress: 'Diproses',
  resolved: 'Selesai',
  rejected: 'Ditolak',
};
const STATUS_COLORS = {
  open: '#1c7ed6',
  accepted: '#845ef7',
  in_progress: '#f08c00',
  resolved: '#2f9e44',
  rejected: '#868e96',
};
const STATUS_KEYS = ['open', 'accepted', 'in_progress', 'resolved', 'rejected'];
const DEFAULT_CENTER = [-7.4558, 112.6817];
const DEFAULT_ZOOM = 11;

export function colorForScore(score) {
  if (score == null) return '#e9ecef';
  if (score < 25) return '#d3f9d8';
  if (score < 50) return '#ffe066';
  if (score < 75) return '#ffa94d';
  return '#ff6b6b';
}

export default function AdminMap({ reports }) {
  const points = reports.filter((r) => typeof r.lat === 'number' && typeof r.lng === 'number');

  const kecamatanStats = useMemo(() => {
    const raw = {};
    points.forEach((r) => {
      const nama = findKecamatan(r.lat, r.lng);
      if (!nama) return;
      if (!raw[nama]) raw[nama] = { total: 0, count: 0 };
      raw[nama].total += r.hazard_score ?? 0;
      raw[nama].count += 1;
    });
    const result = {};
    Object.entries(raw).forEach(([nama, { total, count }]) => {
      result[nama] = { avgScore: Math.round(total / count), count };
    });
    return result;
  }, [points]);

  const kecamatanGeoJSON = useMemo(() => getKecamatanGeoJSON(), []);

  // Gabungkan semua kecamatan dari GeoJSON dengan statistik laporan,
  // supaya kecamatan tanpa laporan tetap tampil di chart & ringkasan.
  const chartData = useMemo(() => {
    const allNames = new Set([
      ...(kecamatanGeoJSON?.features?.map((f) => f.properties.kecamatan) ?? []),
      ...Object.keys(kecamatanStats),
    ]);
    return [...allNames]
      .map((nama) => ({
        kecamatan: nama,
        count: kecamatanStats[nama]?.count ?? 0,
        avgScore: kecamatanStats[nama]?.avgScore ?? null,
      }))
      .sort((a, b) => b.count - a.count);
  }, [kecamatanGeoJSON, kecamatanStats]);

  const summary = useMemo(() => {
    const withReports = chartData.filter((k) => k.count > 0);
    const darurat = withReports.filter((k) => k.avgScore >= 75).length;
    const tanpaLaporan = chartData.length - withReports.length;
    const avgKota = withReports.length
      ? Math.round(withReports.reduce((sum, k) => sum + k.avgScore, 0) / withReports.length)
      : null;
    return {
      totalKecamatan: chartData.length,
      kecamatanTerpantau: withReports.length,
      kecamatanDarurat: darurat,
      kecamatanTanpaLaporan: tanpaLaporan,
      avgKota,
    };
  }, [chartData]);

  const chartHeight = Math.max(220, chartData.length * 26);

  // Data untuk stacked bar: jumlah laporan per status, per kecamatan
  const statusChartData = useMemo(() => {
    const raw = {};
    points.forEach((r) => {
      const nama = findKecamatan(r.lat, r.lng);
      if (!nama) return;
      if (!raw[nama])
        raw[nama] = {
          kecamatan: nama,
          open: 0,
          accepted: 0,
          in_progress: 0,
          resolved: 0,
          rejected: 0,
        };
      if (raw[nama][r.status] !== undefined) raw[nama][r.status] += 1;
    });
    return Object.values(raw).sort((a, b) => {
      const totalA = STATUS_KEYS.reduce((s, k) => s + a[k], 0);
      const totalB = STATUS_KEYS.reduce((s, k) => s + b[k], 0);
      return totalB - totalA;
    });
  }, [points]);

  const statusChartHeight = Math.max(220, statusChartData.length * 30);

  // Top 5 kecamatan dengan skor rata-rata bahaya tertinggi (hanya yang sudah punya laporan)
  const topDarurat = useMemo(() => {
    return chartData
      .filter((d) => d.count > 0)
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5);
  }, [chartData]);

  function styleFeature(feature) {
    const stat = kecamatanStats[feature.properties.kecamatan];
    return {
      fillColor: colorForScore(stat?.avgScore),
      fillOpacity: 0.55,
      color: '#495057',
      weight: 1,
    };
  }

  function onEachFeature(feature, layer) {
    const nama = feature.properties.kecamatan;
    const stat = kecamatanStats[nama];

    layer.bindTooltip(nama, {
      permanent: true,
      direction: 'center',
      className: 'kecamatan-label',
    });

    layer.bindPopup(
      stat
        ? `<strong>${nama}</strong><br/>Skor rata-rata: ${stat.avgScore}<br/>${stat.count} laporan`
        : `<strong>${nama}</strong><br/>Belum ada laporan`
    );
  }

  return (
    <div style={{ width: '100%' }}>
      <style>{`
        .kecamatan-label {
          background: transparent;
          border: none;
          box-shadow: none;
          font-size: 10px;
          font-weight: 700;
          color: #212529;
          text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff;
        }
        .kecamatan-label::before {
          display: none;
        }
      `}</style>

      {/* PETA (lebih kecil) */}
      <div>
        <div style={{ height: 380, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors"
            />

            <GeoJSON data={kecamatanGeoJSON} style={styleFeature} onEachFeature={onEachFeature} />

            {points.map((r) => {
              const style = SEVERITY_STYLE[r.severity] ?? { color: '#868e96', label: r.severity };
              return (
                <CircleMarker
                  key={r.id}
                  center={[r.lat, r.lng]}
                  radius={7}
                  pathOptions={{
                    color: '#fff',
                    weight: 2,
                    fillColor: style.color,
                    fillOpacity: 0.95,
                  }}
                >
                  <Popup minWidth={200}>
                    {r.imageUrl && (
                      <img
                        src={r.imageUrl}
                        alt={damageTypeDisplayLabel(r.damage_type)}
                        style={{
                          width: '100%',
                          maxHeight: 140,
                          objectFit: 'cover',
                          borderRadius: 6,
                          marginBottom: 6,
                        }}
                      />
                    )}
                    <div style={{ fontWeight: 700 }}>{damageTypeDisplayLabel(r.damage_type)}</div>
                    <div>
                      {style.label} · Skor {r.hazard_score}
                    </div>
                    <div style={{ color: '#666', fontSize: 12 }}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>

        <div style={legendRow}>
          <LegendSwatch color="#d3f9d8" label="Aman (<25)" />
          <LegendSwatch color="#ffe066" label="Sedang (25-49)" />
          <LegendSwatch color="#ffa94d" label="Tinggi (50-74)" />
          <LegendSwatch color="#ff6b6b" label="Darurat (75+)" />
          <LegendSwatch color="#e9ecef" label="Belum ada laporan" />
        </div>
      </div>

      {/* RINGKASAN */}
      <div style={{ ...summaryGrid, marginTop: 20 }}>
        <MiniCard
          icon={<MapPin size={18} color="#1c7ed6" />}
          iconBg="#E3F1FD"
          label="Kecamatan Terpantau"
          value={`${summary.kecamatanTerpantau}/${summary.totalKecamatan}`}
        />
        <MiniCard
          icon={<AlertTriangle size={18} color="#e03131" />}
          iconBg="#FBE3E3"
          label="Kecamatan Darurat"
          value={summary.kecamatanDarurat}
        />
        <MiniCard
          icon={<Gauge size={18} color="#f08c00" />}
          iconBg="#FDF1DE"
          label="Rata-rata Skor Kota"
          value={summary.avgKota ?? '-'}
        />
        <MiniCard
          icon={<CircleSlash size={18} color="#868e96" />}
          iconBg="#F1F3F5"
          label="Belum Ada Laporan"
          value={summary.kecamatanTanpaLaporan}
        />
      </div>

      {/* TOP 5 KECAMATAN PALING DARURAT */}
      <div style={panelCard}>
        <h3 style={panelTitle}>Top 5 Kecamatan Paling Darurat</h3>
        {topDarurat.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {topDarurat.map((d, i) => (
              <TopDaruratRow
                key={d.kecamatan}
                rank={i + 1}
                kecamatan={d.kecamatan}
                avgScore={d.avgScore}
                count={d.count}
              />
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--color-ink-soft)', fontSize: 13, marginTop: 10 }}>
            Belum ada data laporan.
          </p>
        )}
      </div>

      {/* DIAGRAM PER KECAMATAN — memanjang penuh di bawah */}
      <div style={panelCard}>
        <h3 style={panelTitle}>Jumlah Laporan per Kecamatan</h3>
        {chartData.some((d) => d.count > 0) ? (
          <div style={{ height: chartHeight, marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                <XAxis type="number" allowDecimals={false} fontSize={11} />
                <YAxis type="category" dataKey="kecamatan" width={110} fontSize={11} />
                <Tooltip
                  formatter={(value, name, props) => [
                    `${value} laporan${props.payload.avgScore != null ? ` · skor rata-rata ${props.payload.avgScore}` : ''}`,
                    'Laporan',
                  ]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {chartData.map((d) => (
                    <Cell
                      key={d.kecamatan}
                      fill={colorForScore(d.avgScore)}
                      stroke="#495057"
                      strokeWidth={0.5}
                    />
                  ))}
                  <LabelList dataKey="count" position="right" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p style={{ color: 'var(--color-ink-soft)', fontSize: 13, marginTop: 10 }}>
            Belum ada data laporan.
          </p>
        )}
      </div>

      {/* STATUS LAPORAN PER KECAMATAN — stacked bar */}
      <div style={panelCard}>
        <h3 style={panelTitle}>Status Laporan per Kecamatan</h3>
        {statusChartData.length > 0 ? (
          <div style={{ height: statusChartHeight, marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={statusChartData}
                layout="vertical"
                margin={{ left: 8, right: 24, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                <XAxis type="number" allowDecimals={false} fontSize={11} />
                <YAxis type="category" dataKey="kecamatan" width={110} fontSize={11} />
                <Tooltip />
                <Legend
                  formatter={(key) => STATUS_LABEL[key] ?? key}
                  wrapperStyle={{ fontSize: 12 }}
                />
                {STATUS_KEYS.map((key) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    name={key}
                    stackId="status"
                    fill={STATUS_COLORS[key]}
                    radius={key === 'rejected' ? [0, 4, 4, 0] : 0}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p style={{ color: 'var(--color-ink-soft)', fontSize: 13, marginTop: 10 }}>
            Belum ada data laporan.
          </p>
        )}
      </div>
    </div>
  );
}

function TopDaruratRow({ rank, kecamatan, avgScore, count }) {
  const RANK_BG = { 1: '#ff6b6b', 2: '#ffa94d', 3: '#ffe066' };
  const badgeBg = RANK_BG[rank] ?? '#e9ecef';
  const badgeColor = rank <= 3 ? '#fff' : '#495057';

  return (
    <div style={topDaruratRow}>
      <div style={{ ...rankBadge, background: badgeBg, color: badgeColor }}>{rank}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 13.5 }}>{kecamatan}</span>
          <span style={{ fontSize: 12, color: 'var(--color-ink-soft)', flexShrink: 0 }}>
            {count} laporan
          </span>
        </div>
        <div style={scoreTrack}>
          <div
            style={{
              ...scoreFill,
              width: `${Math.min(avgScore, 100)}%`,
              background: colorForScore(avgScore),
            }}
          />
        </div>
      </div>
      <div style={{ fontWeight: 800, fontSize: 16, minWidth: 30, textAlign: 'right' }}>
        {avgScore}
      </div>
    </div>
  );
}

function MiniCard({ icon, iconBg, label, value }) {
  return (
    <div style={miniCard}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-ink-soft)' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function LegendSwatch({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 3,
          background: color,
          display: 'inline-block',
          border: '1px solid #ccc',
        }}
      />
      {label}
    </div>
  );
}

const legendRow = { display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 10 };

const summaryGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 10,
};

const miniCard = {
  padding: '14px 16px',
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

const topDaruratRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 4px',
};

const rankBadge = {
  width: 26,
  height: 26,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 800,
  flexShrink: 0,
};

const scoreTrack = {
  height: 6,
  borderRadius: 999,
  background: '#f1f3f5',
  marginTop: 6,
  overflow: 'hidden',
};

const scoreFill = {
  height: '100%',
  borderRadius: 999,
};
