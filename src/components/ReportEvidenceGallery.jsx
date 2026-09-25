import { useEffect, useState } from 'react';
import { getReportPhotos } from '../lib/reports.js';
import ZoomableImage from './ZoomableImage.jsx';

export default function ReportEvidenceGallery({ reportId }) {
  const [photos, setPhotos] = useState([]);
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setPhotos([]);
    setStatus('loading');
    getReportPhotos(reportId)
      .then((items) => {
        if (!active) return;
        setPhotos(items.filter((item) => item.photo_type !== 'resolution'));
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [reportId, attempt]);
  return (
    <section aria-label="Foto pendukung" style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: 14 }}>Foto pendukung</h3>
      {status === 'loading' && <p role="status">Memuat foto pendukung…</p>}
      {status === 'error' && (
        <div role="alert">
          Foto pendukung gagal dimuat.{' '}
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>
            Coba muat foto lagi
          </button>
        </div>
      )}
      {status === 'ready' && !photos.length && (
        <p style={{ fontSize: 12, color: '#666' }}>Belum ada foto tambahan.</p>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 10,
        }}
      >
        {photos.map((photo, index) => (
          <ZoomableImage
            key={photo.id || photo.image_path}
            src={photo.url}
            alt={`Foto pendukung ${index + 1}`}
            style={{
              width: '100%',
              height: 150,
              objectFit: 'contain',
              background: '#f5f5f5',
              borderRadius: 8,
            }}
          />
        ))}
      </div>
    </section>
  );
}
