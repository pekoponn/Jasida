import { useEffect, useRef, useState } from 'react';
import { getCurrentPosition } from '../../lib/geolocation.js';

// Tombol upload foto ini HANYA muncul saat `npm run dev` (development).
// Waktu di-build untuk production (npm run build / demo lomba), otomatis
// hilang — supaya sistem tetap murni kamera-only untuk mencegah laporan palsu.
const IS_DEV = import.meta.env.DEV;

/**
 * Captures a photo directly from the device camera (getUserMedia) instead of
 * a file input — this prevents picking an old photo from the gallery.
 * GPS coordinates are captured at the exact moment the shutter is pressed,
 * so the location is tied to that specific capture, not fetched separately.
 *
 * Note: this raises the bar against casual spoofing (no gallery picker, no
 * re-uploading old screenshots) but is not a cryptographic guarantee — a
 * determined user could still use a virtual camera / GPS-spoofing app.
 * Stronger guarantees would need server-side verification (EXIF, attestation).
 */
export default function CameraCapture({ onCapture, disabled }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle -> starting -> live -> error
  const [error, setError] = useState(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCamera() {
    setStatus('starting');
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }, // prefer back camera
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStatus('live');
    } catch (err) {
      console.error('[camera]', err);
      setStatus('error');
      setError(
        err.name === 'NotAllowedError'
          ? 'Akses kamera ditolak. Izinkan akses kamera di pengaturan browser untuk melapor.'
          : 'Kamera tidak tersedia di perangkat ini.'
      );
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function handleCapture() {
    if (!videoRef.current || capturing) return;
    setCapturing(true);
    setError(null);

    try {
      // Grab GPS at the exact moment of capture — locks location to this photo.
      const positionPromise = getCurrentPosition().catch(() => null);

      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      const file = new File([blob], `report-${Date.now()}.jpg`, { type: 'image/jpeg' });

      const position = await positionPromise;
      const capturedAt = new Date().toISOString();

      stopCamera();
      onCapture({ file, position, capturedAt });
    } catch (err) {
      console.error('[capture]', err);
      setError('Gagal mengambil foto. Coba lagi.');
    } finally {
      setCapturing(false);
    }
  }

  // --- DEV ONLY: upload dari file, bukan dari kamera langsung ---
  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset supaya bisa pilih file yang sama lagi kalau perlu
    if (!file || capturing) return;
    setCapturing(true);
    setError(null);

    try {
      const positionPromise = getCurrentPosition().catch(() => null);
      const position = await positionPromise;
      const capturedAt = new Date().toISOString();

      stopCamera();
      onCapture({ file, position, capturedAt });
    } catch (err) {
      console.error('[dev-upload]', err);
      setError('Gagal memproses foto. Coba lagi.');
    } finally {
      setCapturing(false);
    }
  }

  function DevUploadBlock() {
    if (!IS_DEV) return null;
    return (
      <div style={devUploadBox}>
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#8a5a12' }}>
          🛠️ MODE DEV — hanya muncul di npm run dev, hilang saat production
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
        <button
          type="button"
          disabled={disabled || capturing}
          onClick={() => fileInputRef.current?.click()}
          style={devUploadBtn}
        >
          📁 Upload Foto (testing saja)
        </button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div>
        <div style={errorBox}>
          <p style={{ margin: 0, fontWeight: 600 }}>📷 {error}</p>
          <button style={retryBtn} onClick={startCamera}>Coba lagi</button>
        </div>
        <DevUploadBlock />
      </div>
    );
  }

  return (
    <div>
      <div style={frameWrap}>
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

      <button
        type="button"
        disabled={status !== 'live' || disabled || capturing}
        onClick={handleCapture}
        style={shutterBtn}
      >
        {capturing ? 'Memproses…' : '📸 Ambil Foto'}
      </button>

      <p style={{ fontSize: 12, color: 'var(--color-ink-soft)', textAlign: 'center', marginTop: 6 }}>
        Foto harus diambil langsung dari kamera — tidak bisa unggah dari galeri, supaya lokasi laporan akurat.
      </p>

      <DevUploadBlock />
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
  background: 'var(--color-accent)',
  color: 'var(--color-accent-ink)',
  fontWeight: 700,
  fontSize: 16
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

const devUploadBox = {
  marginTop: 12,
  padding: '10px 12px',
  borderRadius: 'var(--radius-md)',
  background: '#FBF0DA',
  border: '1px dashed #F0D9A8'
};

const devUploadBtn = {
  width: '100%',
  padding: '10px 16px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid #F0D9A8',
  background: '#fff',
  color: '#8a5a12',
  fontWeight: 700,
  fontSize: 14
};