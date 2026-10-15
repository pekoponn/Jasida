import { useEffect, useRef, useState } from 'react';

/**
 * Foto konteks: foto lebar yang memperlihatkan sekitar lokasi.
 * Wajib untuk laporan dengan pin manual, jadi admin punya bahan pembanding.
 */
export default function ContextPhotoField({ photo, onChange, disabled }) {
  const input = useRef(null);
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!photo?.file) {
      setUrl('');
      return undefined;
    }
    const next = URL.createObjectURL(photo.file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [photo]);

  return (
    <div style={box}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
        Foto konteks lokasi <span style={{ color: '#868e96' }}>(opsional)</span>
      </div>
      <p style={hint}>
        Lokasi kamu dipilih manual di peta, jadi laporanmu akan diperiksa admin dulu. Satu foto
        lebar yang memperlihatkan sekitar kerusakan (bangunan, papan nama, tikungan) membantu
        admin memverifikasi lokasinya lebih cepat.
      </p>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Pilih foto konteks lokasi"
        style={{ display: 'none' }}
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file && file.type.startsWith('image/')) {
            onChange({ id: crypto.randomUUID(), file });
          }
        }}
      />

      {url ? (
        <div style={{ marginTop: 10 }}>
          <img src={url} alt="Foto konteks lokasi" style={preview} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              style={btn}
              disabled={disabled}
              onClick={() => input.current?.click()}
            >
              Ganti Foto
            </button>
            <button
              type="button"
              style={btn}
              disabled={disabled}
              onClick={() => onChange(null)}
            >
              Hapus
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          style={{ ...btn, marginTop: 10 }}
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          Pilih / Ambil Foto Konteks
        </button>
      )}
    </div>
  );
}

const box = {
  marginTop: 16,
  padding: '14px 16px',
  borderRadius: 12,
  background: '#FFF8E1',
  border: '1px solid #F0D9A8',
};

const hint = { fontSize: 12.5, color: '#8a5a12', lineHeight: 1.5, margin: '6px 0 0' };

const preview = {
  width: '100%',
  maxHeight: 200,
  objectFit: 'cover',
  borderRadius: 10,
  display: 'block',
};

const btn = {
  padding: '9px 14px',
  borderRadius: 8,
  border: '1px solid #A61C24',
  background: '#fff',
  color: '#A61C24',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};