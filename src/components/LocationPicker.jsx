import { useEffect, useRef, useState } from 'react';
import { validateReportLocation } from '../lib/reportLocation.js';
import { checkRoadDistance, ROAD_MAX_M } from '../lib/roadCheck.js';
import { streetViewUrl } from '../lib/mapLinks.js';

// Pin merah custom (#A61C24) biar konsisten sama warna marker di peta "foto realtime",
// bukan pin biru bawaan Leaflet.
const RED_PIN_SVG = `
  <svg width="32" height="42" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z" fill="#A61C24"/>
    <circle cx="12" cy="12" r="5" fill="#ffffff"/>
  </svg>
`;

export default function LocationPicker({
  testingMode,
  onConfirm,
  onCancel,
  initialPoint = null,
  intro = 'Foto ini tidak memiliki data lokasi.',
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const redIconRef = useRef(null);
  const requestRef = useRef(0);
  const [picked, setPicked] = useState(null);
  const [error, setError] = useState(null);
  // null | { state: 'loading' | 'ok' | 'far' | 'none' | 'unknown', distanceM?, nearest?, name? }
  const [road, setRoad] = useState(null);

  async function runRoadCheck(point) {
    const id = ++requestRef.current;
    setRoad({ state: 'loading' });
    const result = await checkRoadDistance(point).catch(() => null);
    if (id !== requestRef.current) return; // klik yang lebih baru sudah menggantikan
    if (!result) return setRoad({ state: 'unknown' });
    if (!result.nearest) return setRoad({ state: 'none' });
    return setRoad({
      state: result.distanceM <= ROAD_MAX_M ? 'ok' : 'far',
      distanceM: result.distanceM,
      nearest: result.nearest,
      name: result.name,
    });
  }

  function snapToRoad() {
    if (!road?.nearest) return;
    const point = { lat: road.nearest.lat, lng: road.nearest.lng };
    markerRef.current?.setLatLng([point.lat, point.lng]);
    mapInstanceRef.current?.panTo([point.lat, point.lng]);
    setPicked(point);
    setError(validateReportLocation(point, testingMode));
    requestRef.current += 1;
    setRoad({ state: 'ok', distanceM: 0, nearest: road.nearest, name: road.name });
  }

  useEffect(() => {
    if (!window.L || !mapContainerRef.current || mapInstanceRef.current) return;
    const L = window.L;

    redIconRef.current = L.divIcon({
      className: '',
      html: RED_PIN_SVG,
      iconSize: [32, 42],
      iconAnchor: [16, 42],
      popupAnchor: [0, -38],
    });

    const defaultCenter = [-7.4478, 112.7183]; // pusat Sidoarjo
    const map = L.map(mapContainerRef.current).setView(
      initialPoint ? [initialPoint.lat, initialPoint.lng] : defaultCenter,
      initialPoint ? 17 : 12
    );
    mapInstanceRef.current = map;

    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Tiles &copy; Esri' }
    );
    L.control.layers({ Peta: osm, Satelit: satellite }, null, { position: 'topright' }).addTo(map);

    map.on('click', (e) => {
      const point = { lat: e.latlng.lat, lng: e.latlng.lng };
      setPicked(point);
      const locationError = validateReportLocation(point, testingMode);
      setError(locationError);

      if (!markerRef.current) {
        markerRef.current = L.marker([point.lat, point.lng], { icon: redIconRef.current }).addTo(
          map
        );
      } else {
        markerRef.current.setLatLng([point.lat, point.lng]);
      }

      if (locationError) {
        requestRef.current += 1;
        setRoad(null);
      } else {
        runRoadCheck(point);
      }
    });

    const resizeTimer = setTimeout(() => map.invalidateSize(), 100);

    return () => {
      clearTimeout(resizeTimer);
      requestRef.current += 1;
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [testingMode]);

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-labelledby="picker-title">
      <div style={panel}>
        <h3 id="picker-title" style={{ marginTop: 0, fontSize: 18 }}>
          Pilih Lokasi Kerusakan
        </h3>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
          {intro} Zoom lalu ketuk peta tepat di titik kerusakan jalan berada. Gunakan tombol layer
          di pojok peta untuk beralih ke tampilan satelit.
          {!testingMode && ' Titik harus berada di dalam wilayah Kabupaten Sidoarjo.'}
        </p>
        <div ref={mapContainerRef} style={mapBox} />

        {error && <p style={errorStyle}>{error}</p>}

        {picked && !error && (
          <p style={okStyle}>
            Lokasi dipilih: {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
          </p>
        )}

        {picked && !error && road && <RoadMessage road={road} onSnap={snapToRoad} />}

        {picked && !error && (
          <div style={{ marginTop: 10 }}>
            <a
              href={streetViewUrl(picked.lat, picked.lng)}
              target="_blank"
              rel="noreferrer"
              style={streetBtn}
            >
              Lihat di Street View ↗
            </a>
            <p style={{ ...infoStyle, marginTop: 6 }}>
              Dibuka di tab baru. Cek apakah itu jalan yang kamu maksud, lalu kembali ke halaman
              ini.
            </p>
          </div>
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

function RoadMessage({ road, onSnap }) {
  if (road.state === 'loading') {
    return <p style={infoStyle}>Memeriksa jarak ke jalan…</p>;
  }
  if (road.state === 'ok') {
    return (
      <p style={okStyle}>
        ✓ Titik dekat jalan{road.name ? ` (${road.name})` : ''}
        {road.distanceM > 0 ? `, sekitar ${Math.round(road.distanceM)} m` : ''}.
      </p>
    );
  }
  if (road.state === 'far') {
    return (
      <div style={warnBox}>
        <div>
          ⚠ Titik berjarak sekitar {Math.round(road.distanceM)} m dari jalan terdekat
          {road.name ? ` (${road.name})` : ''}. Laporan dengan titik jauh dari jalan akan diperiksa
          admin lebih dulu.
        </div>
        <button type="button" style={snapBtn} onClick={onSnap}>
          Geser titik ke jalan terdekat
        </button>
      </div>
    );
  }
  if (road.state === 'none') {
    return (
      <p style={warnBox}>
        ⚠ Tidak ada jalan dalam radius 60 m dari titik ini. Laporan akan diperiksa admin lebih dulu.
        Coba geser titik ke jalan yang benar.
      </p>
    );
  }
  return (
    <p style={infoStyle}>
      Pemeriksaan jarak ke jalan sedang tidak tersedia. Laporan akan diperiksa admin lebih dulu.
    </p>
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
const infoStyle = { color: '#868e96', fontSize: 13, marginTop: 10 };
const warnBox = {
  marginTop: 10,
  padding: '10px 12px',
  borderRadius: 8,
  background: '#FFF8E1',
  border: '1px solid #F0D9A8',
  color: '#8a5a12',
  fontSize: 13,
  lineHeight: 1.5,
};
const snapBtn = {
  marginTop: 8,
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #A61C24',
  background: '#fff',
  color: '#A61C24',
  fontWeight: 700,
  fontSize: 12.5,
  cursor: 'pointer',
};
const streetBtn = {
  display: 'inline-block',
  padding: '9px 14px',
  borderRadius: 8,
  border: '1px solid #A61C24',
  background: '#fff',
  color: '#A61C24',
  fontWeight: 700,
  fontSize: 13,
  textDecoration: 'none',
};

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
