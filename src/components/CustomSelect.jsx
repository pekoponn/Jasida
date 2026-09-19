import { useEffect, useRef, useState } from 'react';

export default function CustomSelect({ value, onChange, options, placeholder = 'Pilih' }) {
  const [open, setOpen] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(-1);
  const wrapperRef = useRef(null);

  // Terima options sebagai array string (perilaku lama, tetap dipakai filter Kecamatan)
  // ATAU array objek { value, label } (dipakai untuk filter yang value & labelnya beda,
  // misal value "open" tapi label "Masuk (5)").
  const isObjectOptions = options.length > 0 && typeof options[0] === 'object';
  const normalizedOptions = isObjectOptions ? options : options.map((opt) => ({ value: opt, label: opt }));

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(optValue) {
    onChange(optValue);
    setOpen(false);
  }

  const selectedLabel = normalizedOptions.find((o) => o.value === value)?.label;

  return (
    <div ref={wrapperRef} style={{ position: 'relative', minWidth: 180 }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={triggerStyle}>
        <span style={{ color: selectedLabel ? '#495057' : '#868e96' }}>
          {selectedLabel || placeholder}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="#a61e4d" strokeWidth="2"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', flexShrink: 0 }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div style={panelStyle}>
          {/* Baris placeholder "Semua ..." cuma ditampilkan otomatis untuk mode string biasa
              (mis. filter Kecamatan). Untuk mode objek, sertakan sendiri opsi "Semua" di data-nya. */}
          {!isObjectOptions && (
            <div
              onMouseEnter={() => setHoverIndex(-1)}
              onClick={() => handleSelect('')}
              style={{
                ...optionStyle,
                backgroundColor: hoverIndex === -1 ? '#FDECEE' : '#fff',
                color: value === '' ? '#a61e4d' : '#495057',
                fontWeight: value === '' ? 700 : 500
              }}
            >
              {placeholder}
            </div>
          )}
          {normalizedOptions.map((opt, i) => (
            <div
              key={opt.value}
              onMouseEnter={() => setHoverIndex(i)}
              onClick={() => handleSelect(opt.value)}
              style={{
                ...optionStyle,
                backgroundColor: hoverIndex === i ? '#FDECEE' : '#fff',
                color: value === opt.value ? '#a61e4d' : '#495057',
                fontWeight: value === opt.value ? 700 : 500
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const triggerStyle = {
  width: '100%',
  padding: '10px 18px',
  borderRadius: 24,
  border: '1px solid #dee2e6',
  backgroundColor: '#ffffff',
  fontSize: 13,
  outline: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  fontFamily: 'inherit'
};

const panelStyle = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  left: 0,
  right: 0,
  maxHeight: 260,
  overflowY: 'auto',
  background: '#ffffff',
  border: '1px solid #dee2e6',
  borderRadius: 12,
  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
  zIndex: 1000,
  padding: 6
};

const optionStyle = {
  padding: '9px 14px',
  borderRadius: 8,
  fontSize: 13,
  cursor: 'pointer',
  whiteSpace: 'nowrap'
};