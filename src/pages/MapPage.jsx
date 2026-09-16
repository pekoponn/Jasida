import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { listOpenReports } from '../lib/reports.js';
import SeverityBadge from '../components/SeverityBadge.jsx';

const SEVERITY_COLOR = {
  aman: '#2F9E44',
  sedang: '#E8A93B',
  darurat: '#D62828'
};

const DEFAULT_CENTER = [-7.4478, 112.7183];

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
          Laporan belum dapat dimuat. Periksa koneksi dan muat ulang halaman.
        </p>
      )}

      <div style={{ marginTop: 16, borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        <MapContainer center={DEFAULT_CENTER} zoom={13} style={{ height: 420, width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {reports.filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng)).map((r) => {
            const { lat, lng } = r;
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
                  <strong style={{ textTransform: 'capitalize' }}>{(r.damage_type ?? 'Kerusakan jalan').replaceAll('_', ' ')}</strong>
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
