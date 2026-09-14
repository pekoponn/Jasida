import { useEffect, useRef } from 'react';

export default function MapPreview({ lat, lng, label = 'Lokasi Laporan' }) {
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

      markerRef.current = window.L.marker([lat, lng], { icon: reportPinIcon })
        .addTo(mapInstanceRef.current)
        .bindTooltip(label, {
          permanent: true,
          direction: 'top',
          offset: [0, -58],
          className: 'rw-marker-tooltip'
        });
    } else {
      mapInstanceRef.current.setView([lat, lng], 17);
      markerRef.current.setLatLng([lat, lng]);
      markerRef.current.setTooltipContent(label);
    }

    setTimeout(() => mapInstanceRef.current?.invalidateSize(), 100);

    return () => {

    };
  }, [lat, lng, label]);

  useEffect(() => {
    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  if (!lat || !lng) return null;

  return (
    <>
      <style>{markerCss}</style>
      <div ref={mapContainerRef} style={mapBox} />
    </>
  );
}

const reportPinIcon = window.L
  ? window.L.divIcon({
      className: 'rw-marker-wrap',
      html: `
        <div class="rw-marker-ring"></div>
        <div class="rw-marker-pin">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none">
            <path d="M12 2C7.58 2 4 5.58 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4.42-3.58-8-8-8z" fill="#A61C24" stroke="#ffffff" stroke-width="1.5"/>
            <circle cx="12" cy="10" r="3" fill="#ffffff"/>
          </svg>
        </div>
      `,
      iconSize: [46, 66],
      iconAnchor: [23, 50]
    })
  : null;

const markerCss = `
  .rw-marker-wrap { position: relative; width: 46px; height: 66px; }

  .rw-marker-ring {
    position: absolute;
    left: 50%;
    top: 30px;
    width: 40px;
    height: 40px;
    transform: translate(-50%, 0);
    border: 2px dashed #A61C24;
    border-radius: 50%;
    background: rgba(166, 28, 36, 0.08);
  }

  .rw-marker-pin {
    position: absolute;
    left: 50%;
    top: 0;
    transform: translateX(-50%);
    filter: drop-shadow(0 2px 3px rgba(0,0,0,0.25));
  }

  .leaflet-tooltip.rw-marker-tooltip {
    background: #ffffff;
    color: #A61C24;
    font-weight: 700;
    font-size: 13px;
    border: 1.5px solid #A61C24;
    border-radius: 8px;
    padding: 6px 14px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.12);
  }

  .leaflet-tooltip.rw-marker-tooltip::before {
    border-top-color: #A61C24;
  }
`;

const mapBox = {
  width: '100%',
  height: 180,
  borderRadius: 'var(--radius-lg)',
  marginTop: 10,
  overflow: 'hidden'
};