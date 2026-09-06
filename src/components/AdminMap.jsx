import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { damageTypeDisplayLabel } from '../ai/hazardScore.js';
import { SEVERITY_STYLE } from '../pages/AdminDashboardPage.jsx';
import { findKecamatan, getKecamatanGeoJSON } from '../lib/kecamatanBoundaries.js';

const STATUS_LABEL = { open: 'Baru', in_progress: 'Diproses', resolved: 'Selesai' };
const DEFAULT_CENTER = [-7.4558, 112.6817]; // Tengah Kabupaten Sidoarjo
const DEFAULT_ZOOM = 11;

export function colorForScore(score) {
  if (score == null) return '#e9ecef'; // belum ada laporan di kecamatan ini
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

  function styleFeature(feature) {
    const stat = kecamatanStats[feature.properties.kecamatan];
    return {
      fillColor: colorForScore(stat?.avgScore),
      fillOpacity: 0.55,
      color: '#495057',
      weight: 1
    };
  }

    function onEachFeature(feature, layer) {
    const nama = feature.properties.kecamatan;
    const stat = kecamatanStats[nama];

    // Label nama kecamatan, selalu tampil di tengah wilayah
    layer.bindTooltip(nama, {
      permanent: true,
      direction: 'center',
      className: 'kecamatan-label'
    });

    // Detail statistik muncul saat kecamatan diklik
    layer.bindPopup(
      stat
        ? `<strong>${nama}</strong><br/>Skor rata-rata: ${stat.avgScore}<br/>${stat.count} laporan`
        : `<strong>${nama}</strong><br/>Belum ada laporan`
    );
  }

   return (
    <div>
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
      <div style={{ height: 480, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ height: '100%', width: '100%' }}>
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
                radius={8}
                pathOptions={{ color: '#fff', weight: 2, fillColor: style.color, fillOpacity: 0.95 }}
              >
                <Popup minWidth={200}>
                  {r.imageUrl && (
                    <img
                      src={r.imageUrl}
                      alt={damageTypeDisplayLabel(r.damage_type)}
                      style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 6, marginBottom: 6 }}
                    />
                  )}
                  <div style={{ fontWeight: 700 }}>{damageTypeDisplayLabel(r.damage_type)}</div>
                  <div>{style.label} · Skor {r.hazard_score}</div>
                  <div style={{ color: '#666', fontSize: 12 }}>{STATUS_LABEL[r.status] ?? r.status}</div>
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
  );
}

function LegendSwatch({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{ width: 12, height: 12, borderRadius: 3, background: color, display: 'inline-block', border: '1px solid #ccc' }} />
      {label}
    </div>
  );
}

const legendRow = { display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 10 };