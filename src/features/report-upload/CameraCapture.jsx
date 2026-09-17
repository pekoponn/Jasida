import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { getCurrentPosition } from '../../lib/geolocation.js';

export default function CameraCapture({ onCapture, disabled, onBusyChange }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraRequest = useRef(0);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [capturing, setCapturing] = useState(false);
  useEffect(() => { onBusyChange?.(capturing); }, [capturing, onBusyChange]);

  useEffect(() => {
    startCamera();
    return () => { cameraRequest.current += 1; stopCamera(); };
  }, []);

  async function startCamera() {
    const request = ++cameraRequest.current;
    stopCamera();
    setStatus('starting');
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      if (request !== cameraRequest.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStatus('live');
    } catch (err) {
      if (request !== cameraRequest.current) return;
      setStatus('error');
      setError(
        err.name === 'NotAllowedError'
          ? 'Akses kamera ditolak. Izinkan kamera di pengaturan browser, lalu coba lagi.'
          : 'Kamera tidak tersedia di perangkat ini.'
      );
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function handleCapture() {
    if (!videoRef.current || capturing || disabled) return;
    setCapturing(true);
    setError(null);

    try {
      const positionPromise = getCurrentPosition().catch(() => null);

      const video = videoRef.current;
      if (!video.videoWidth || !video.videoHeight) throw new Error('Kamera belum siap. Coba lagi sebentar.');
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error('Gagal mengambil foto dari kamera.');
      const file = new File([blob], `report-${Date.now()}.jpg`, { type: 'image/jpeg' });

      const position = await positionPromise;
      const capturedAt = new Date().toISOString();

      await onCapture({ file, position, capturedAt });
    } catch (err) {
      console.error('[capture]', err);
      setError('Gagal mengambil foto. Coba lagi.');
    } finally {
      setCapturing(false);
    }
  }

  return (
    <div>
      <div style={{ ...frameWrap, display: status === 'error' ? 'none' : 'block' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', display: 'block', borderRadius: 'var(--radius-lg)', background: '#000' }}
        />
        {status === 'starting' && (
          <div style={overlay}>Menyalakan kamera…</div>
        )}
      </div>

      {error && <div style={errorBox} role="status"><p>{error}</p>
        {status === 'error' && <button type="button" disabled={disabled || capturing} style={retryBtn} onClick={startCamera}>Coba kamera lagi</button>}
      </div>}

      <button
        type="button"
        disabled={status !== 'live' || disabled || capturing}
        onClick={handleCapture}
        style={shutterBtn}
      >
        {capturing ? (
          'Memproses…'
        ) : (
          <>
            <Camera size={18} /> Ambil Foto
          </>
        )}
      </button>

      <p style={{ fontSize: 12, color: 'var(--color-ink-soft)', textAlign: 'center', marginTop: 6 }}>
        Gunakan foto terbaru. Lokasi laporan mengikuti GPS perangkat saat foto diambil.
      </p>
    </div>
  );
}

const frameWrap = {
  position: 'relative',
  aspectRatio: '4 / 3',
  overflow: 'hidden',
  borderRadius: 'var(--radius-lg)',
  background: '#000'
};

const overlay = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600
};

const shutterBtn = {
  width: '100%',
  marginTop: 12,
  padding: '14px',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  background: '#A61C24',
  color: '#fff',
  fontWeight: 700,
  fontSize: 16,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8
};

const errorBox = {
  padding: 20,
  borderRadius: 'var(--radius-lg)',
  background: 'var(--color-surface-raised)',
  border: '1px solid var(--color-border)',
  textAlign: 'center'
};

const retryBtn = {
  marginTop: 12,
  padding: '10px 18px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  fontWeight: 600
};