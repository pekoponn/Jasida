import { useEffect, useRef } from 'react';

/**
 * Peta kecil menampilkan titik lokasi laporan.
 * Pakai Leaflet + OpenStreetMap (gratis, tidak perlu API key),
 * dimuat lewat CDN di index.html.
 */
export default function MapPreview({ lat, lng }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!lat || !lng || !window.L || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = window.L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: true
      }).setView([lat, lng], 17);

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstanceRef.current);

      markerRef.current = window.L.marker([lat, lng]).addTo(mapInstanceRef.current);
    } else {
      mapInstanceRef.current.setView([lat, lng], 17);
      markerRef.current.setLatLng([lat, lng]);
    }

    // Leaflet butuh ini kalau container-nya baru muncul/berubah ukuran
    setTimeout(() => mapInstanceRef.current?.invalidateSize(), 100);

    return () => {
      // jangan destroy map tiap render — cukup update posisi saja (di atas)
    };
  }, [lat, lng]);

  useEffect(() => {
    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  if (!lat || !lng) return null;

  return <div ref={mapContainerRef} style={mapBox} />;
}

const mapBox = {
  width: '100%',
  height: 180,
  borderRadius: 'var(--radius-lg)',
  marginTop: 10,
  overflow: 'hidden'
};