import { useEffect, useRef, useState } from 'react';
import CameraCapture from './CameraCapture.jsx';
import { PHOTO_INPUT_ACCEPT } from '../../lib/imageUpload.js';
import { MAX_REPORT_PHOTOS } from '../../ai/multiPhoto.js';
import ZoomableImage from '../../components/ZoomableImage.jsx';

export default function ReportPhotoPicker({ photos, onSelect, onRemove, disabled, onBusyChange }) {
  const input = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [replaceId, setReplaceId] = useState(null);
  const full = photos.length >= MAX_REPORT_PHOTOS;

  async function select(files, source, capture = {}) {
    const accepted = await onSelect({ files, source, replaceId, ...capture });
    if (accepted) {
      setCameraOpen(false);
      setReplaceId(null);
    }
  }

  return (
    <div>
      <p style={{ fontSize: 13, lineHeight: 1.6 }}>
        Pilih 1–5 foto dari kamera atau galeri. Sebaiknya sertakan 2–3 sudut dari kerusakan yang
        sama: tampak dekat, samping, dan kondisi sekitarnya.
      </p>
      <p style={{ fontSize: 12, color: '#666' }}>
        Gunakan foto terbaru di lokasi yang sedang kamu kunjungi. Lokasi mengikuti GPS perangkat
        saat ini, bukan lokasi dari file galeri.
      </p>
      <input
        ref={input}
        type="file"
        aria-label="Pilih foto dari galeri"
        accept={PHOTO_INPUT_ACCEPT}
        multiple={!replaceId}
        disabled={disabled || (full && !replaceId)}
        style={{ display: 'none' }}
        onChange={async (event) => {
          const files = Array.from(event.target.files || []);
          event.target.value = '';
          if (files.length) await select(files, 'gallery');
        }}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          style={button}
          disabled={disabled || (full && !replaceId)}
          onClick={() => input.current?.click()}
        >
          Pilih dari Galeri
        </button>
        {!cameraOpen && (
          <button
            type="button"
            style={button}
            disabled={disabled || full}
            onClick={() => setCameraOpen(true)}
          >
            {photos.length ? 'Tambah dari Kamera' : 'Buka Kamera'}
          </button>
        )}
      </div>
      {replaceId && (
        <p role="status">
          Ambil atau pilih foto pengganti. Foto lama tetap ada sampai penggantinya siap.
        </p>
      )}
      {cameraOpen && (!full || replaceId) && (
        <div style={{ marginTop: 12 }}>
          <CameraCapture
            disabled={disabled}
            onBusyChange={onBusyChange}
            onCapture={({ file, ...capture }) => select([file], 'camera', capture)}
          />
          <button
            type="button"
            style={button}
            disabled={disabled}
            onClick={() => {
              setCameraOpen(false);
              setReplaceId(null);
            }}
          >
            Tutup Kamera
          </button>
        </div>
      )}
      <p aria-live="polite">
        {photos.length}/{MAX_REPORT_PHOTOS} foto dipilih
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
        }}
      >
        {photos.map((photo, index) => (
          <div key={photo.id} style={{ minWidth: 0 }}>
            <PhotoPreview file={photo.file} index={index} />
            <p style={{ fontSize: 12 }}>
              Foto {index + 1} · {photo.source === 'gallery' ? 'Galeri' : 'Kamera'}
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                style={button}
                disabled={disabled}
                aria-label={`Ambil ulang foto ${index + 1}`}
                onClick={() => {
                  setReplaceId(photo.id);
                  setCameraOpen(true);
                }}
              >
                Ambil Ulang
              </button>
              <button
                type="button"
                style={button}
                disabled={disabled}
                aria-label={`Hapus foto ${index + 1}`}
                onClick={() => {
                  onRemove(photo.id);
                  if (replaceId === photo.id) setReplaceId(null);
                }}
              >
                Hapus
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhotoPreview({ file, index }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url ? (
    <ZoomableImage
      src={url}
      alt={`Pratinjau foto ${index + 1}`}
      style={{
        width: '100%',
        height: 150,
        objectFit: 'contain',
        background: '#f5f5f5',
        borderRadius: 10,
      }}
    />
  ) : null;
}

const button = {
  padding: '10px 12px',
  background: '#fff',
  color: '#A61C24',
  border: '1px solid #A61C24',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
};
