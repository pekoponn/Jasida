import { useEffect, useRef, useState } from 'react';
import { validateReportLocation } from '../lib/reportLocation.js';

// Pin merah custom (#A61C24) biar konsisten sama warna marker di peta "foto realtime",
// bukan pin biru bawaan Leaflet.
const RED_PIN_SVG = `
  <svg width="32" height="42" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z" fill="#A61C24"/>
    <circle cx="12" cy="12" r="5" fill="#ffffff"/>
  </svg>
`;

export default function LocationPicker({ testingMode, onConfirm, onCancel }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const redIconRef = useRef(null);
  const [picked, setPicked] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!window.L || !mapContainerRef.current || mapInstanceRef.current) return;

    redIconRef.current = window.L.divIcon({
      className: '',
      html: RED_PIN_SVG,
      iconSize: [32, 42],
      iconAnchor: [16, 42],
      popupAnchor: [0, -38],
    });

    const defaultCenter = [-7.4478, 112.7183]; // pusat Sidoarjo
    mapInstanceRef.current = window.L.map(mapContainerRef.current).setView(defaultCenter, 12);

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapInstanceRef.current);

    mapInstanceRef.current.on('click', (e) => {
      const point = { lat: e.latlng.lat, lng: e.latlng.lng };
      setPicked(point);
      setError(validateReportLocation(point, testingMode));

      if (!markerRef.current) {
        markerRef.current = window.L.marker([point.lat, point.lng], {
          icon: redIconRef.current,
        }).addTo(mapInstanceRef.current);
      } else {
        markerRef.current.setLatLng([point.lat, point.lng]);
      }
    });

    setTimeout(() => mapInstanceRef.current?.invalidateSize(), 100);

    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, [testingMode]);

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-labelledby="picker-title">
      <div style={panel}>
        <h3 id="picker-title" style={{ marginTop: 0, fontSize: 18 }}>
          Pilih Lokasi Kerusakan
        </h3>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
          Foto ini tidak memiliki data lokasi. Ketuk peta di titik kerusakan jalan berada.
          {!testingMode && ' Titik harus berada di dalam wilayah Kabupaten Sidoarjo.'}
        </p>
        <div ref={mapContainerRef} style={mapBox} />
        {error && <p style={errorStyle}>{error}</p>}
        {picked && !error && (
          <p style={okStyle}>
            Lokasi dipilih: {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button type="button" style={secondaryBtn} onClick={onCancel}>
            Batal
          </button>
          <button
            type="button"
            style={primaryBtn}
            disabled={!picked || !!error}
            onClick={() => onConfirm(picked)}
          >
            Konfirmasi Lokasi
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(25,27,31,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 2200,
};

const panel = {
  width: '100%',
  maxWidth: 520,
  background: '#fff',
  borderRadius: 16,
  padding: '20px 20px 24px',
  maxHeight: '90vh',
  overflowY: 'auto',
};

const mapBox = {
  width: '100%',
  height: 320,
  borderRadius: 10,
  overflow: 'hidden',
};

const errorStyle = { color: '#e03131', fontSize: 13, marginTop: 10 };
const okStyle = { color: '#2f9e44', fontSize: 13, marginTop: 10, fontWeight: 600 };

const primaryBtn = {
  flex: 1,
  padding: '12px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#A61C24',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryBtn = {
  flex: 1,
  padding: '12px 16px',
  borderRadius: 8,
  border: '1.5px solid #dee2e6',
  background: '#fff',
  color: '#495057',
  fontWeight: 600,
  cursor: 'pointer',
};