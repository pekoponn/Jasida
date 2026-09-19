import { useState } from 'react';

export default function ZoomableImage({ src, alt = '', style, className, zoomAlt }) {
  const [zoomed, setZoomed] = useState(false);

  if (!src) return null;

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={className}
        onClick={() => setZoomed(true)}
        style={{ cursor: 'pointer', ...style }}
      />
      {zoomed && (
        <div style={overlay} onClick={() => setZoomed(false)}>
          <img
            src={src}
            alt={zoomAlt || alt}
            style={zoomImg}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            style={zoomCloseBtn}
            onClick={() => setZoomed(false)}
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}

const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.8)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
};

const zoomImg = {
  maxWidth: '90vw',
  maxHeight: '90vh',
  borderRadius: 12,
  display: 'block',
};

const zoomCloseBtn = {
  position: 'fixed',
  top: 20,
  right: 20,
  width: 40,
  height: 40,
  borderRadius: '50%',
  border: 'none',
  background: '#fff',
  color: '#333',
  fontSize: 16,
  cursor: 'pointer',
  zIndex: 10000,
};
