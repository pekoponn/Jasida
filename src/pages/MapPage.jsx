import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { listOpenReports } from '../lib/reports.js';
import SeverityBadge from '../components/SeverityBadge.jsx';

const SEVERITY_COLOR = {
  low: '#2F9E44',
  medium: '#E8A93B',
  high: '#E0561F',
  emergency: '#D62828'
};

const DEFAULT_CENTER = [-6.2088, 106.8456]; // Jakarta — ganti sesuai kota demo kamu

export default function MapPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    listOpenReports()
      .then(setReports)
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <h1 className="display" style={{ fontSize: 24, marginBottom: 4 }}>Peta laporan</h1>
      <p style={{ color: 'var(--color-ink-soft)', marginTop: 0, fontSize: 14 }}>
        Semua laporan kerusakan yang masih aktif di sekitar kota.
      </p>

      {loadError && (
        <p style={{ fontSize: 13, color: 'var(--color-ink-soft)', marginTop: 8 }}>
          Belum bisa memuat data ({loadError}). Pastikan Supabase sudah dikonfigurasi di .env.
        </p>
      )}

      <div style={{ marginTop: 16, borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        <MapContainer center={DEFAULT_CENTER} zoom={13} style={{ height: 420, width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {reports.map((r) => {
            const [lng, lat] = parsePoint(r.location);
            return (
              <CircleMarker
                key={r.id}
                center={[lat, lng]}
                radius={9}
                pathOptions={{
                  color: SEVERITY_COLOR[r.severity] ?? '#5B5F68',
                  fillColor: SEVERITY_COLOR[r.severity] ?? '#5B5F68',
                  fillOpacity: 0.85
                }}
              >
                <Popup>
                  <strong style={{ textTransform: 'capitalize' }}>{r.damage_type.replaceAll('_', ' ')}</strong>
                  <div style={{ marginTop: 4 }}>
                    <SeverityBadge severity={r.severity} score={r.hazard_score} />
                  </div>
                  <div style={{ fontSize: 12, marginTop: 6, color: '#5B5F68' }}>
                    👥 {r.support_count} konfirmasi
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {!loading && reports.length === 0 && !loadError && (
        <p style={{ fontSize: 14, color: 'var(--color-ink-soft)', marginTop: 16 }}>
          Belum ada laporan. Jadilah yang pertama melapor!
        </p>
      )}
    </section>
  );
}

// PostGIS geography returns as WKT/GeoJSON-ish text depending on select shape;
// with supabase-js + PostgREST it typically comes back as GeoJSON when cast.
// Adjust this parser to match what your `reports` select actually returns.
function parsePoint(location) {
  if (location?.coordinates) return location.coordinates; // GeoJSON: [lng, lat]
  if (typeof location === 'string') {
    const match = location.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
    if (match) return [Number(match[1]), Number(match[2])];
  }
  return [DEFAULT_CENTER[1], DEFAULT_CENTER[0]];
}
