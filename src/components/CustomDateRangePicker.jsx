import { useEffect, useRef, useState } from 'react';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function toISO(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fromISO(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplay(str) {
  if (!str) return 'mm/dd/yyyy';
  const [y, m, d] = str.split('-');
  return `${m}/${d}/${y}`;
}

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

export default function CustomDateRangePicker({ startDate, endDate, onChange }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => fromISO(startDate) || new Date());
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const start = fromISO(startDate);
  const end = fromISO(endDate);

  function handleDayClick(day) {
    if (!day) return;
    if (!start || (start && end)) {
      onChange(toISO(day), '');
    } else if (start && !end) {
      if (day < start) {
        onChange(toISO(day), toISO(start));
      } else {
        onChange(toISO(start), toISO(day));
      }
    }
  }

  function isInRange(day) {
    if (!day || !start || !end) return false;
    return day >= start && day <= end;
  }

  function isSameDay(a, b) {
    return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const cells = buildMonthGrid(year, month);

  function goPrevMonth() {
    setViewDate(new Date(year, month - 1, 1));
  }
  function goNextMonth() {
    setViewDate(new Date(year, month + 1, 1));
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={triggerStyle}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a61e4d" strokeWidth="2">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 9h18M8 3v4M16 3v4" />
        </svg>
        <span style={{ color: (startDate || endDate) ? '#495057' : '#868e96', fontSize: 13 }}>
          {formatDisplay(startDate)} <span style={{ color: '#adb5bd' }}>s/d</span> {formatDisplay(endDate)}
        </span>
      </button>

      {open && (
        <div style={panelStyle}>
          <div style={headerRow}>
            <button type="button" onClick={goPrevMonth} style={navBtnStyle}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#343a40' }}>
              {MONTH_NAMES[month]} {year}
            </span>
            <button type="button" onClick={goNextMonth} style={navBtnStyle}>›</button>
          </div>

          <div style={weekRow}>
            {DAY_NAMES.map((d) => (
              <div key={d} style={weekLabel}>{d}</div>
            ))}
          </div>

          <div style={gridStyle}>
            {cells.map((day, i) => {
              const selected = isSameDay(day, start) || isSameDay(day, end);
              const inRange = isInRange(day);
              return (
                <div
                  key={i}
                  onClick={() => handleDayClick(day)}
                  style={{
                    ...dayCellStyle,
                    visibility: day ? 'visible' : 'hidden',
                    backgroundColor: selected ? '#a61e4d' : inRange ? '#FDECEE' : 'transparent',
                    color: selected ? '#ffffff' : '#343a40',
                    fontWeight: selected ? 700 : 500,
                    cursor: day ? 'pointer' : 'default'
                  }}
                >
                  {day ? day.getDate() : ''}
                </div>
              );
            })}
          </div>

          <div style={footerRow}>
            <button type="button" onClick={() => onChange('', '')} style={clearBtnStyle}>
              Reset
            </button>
            <button type="button" onClick={() => setOpen(false)} style={doneBtnStyle}>
              Selesai
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const triggerStyle = {
  padding: '10px 16px',
  borderRadius: 24,
  border: '1px solid #dee2e6',
  backgroundColor: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
  fontFamily: 'inherit'
};

const panelStyle = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  right: 0,
  width: 280,
  background: '#ffffff',
  border: '1px solid #dee2e6',
  borderRadius: 12,
  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
  zIndex: 1000,
  padding: 14
};

const headerRow = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 };
const navBtnStyle = { border: 'none', background: 'none', fontSize: 18, color: '#a61e4d', cursor: 'pointer', width: 28, height: 28, borderRadius: '50%' };
const weekRow = { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 };
const weekLabel = { textAlign: 'center', fontSize: 11, color: '#adb5bd', fontWeight: 600 };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 };
const dayCellStyle = { height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, borderRadius: 8 };
const footerRow = { display: 'flex', justifyContent: 'space-between', marginTop: 12 };
const clearBtnStyle = { border: 'none', background: 'none', color: '#868e96', fontSize: 12, cursor: 'pointer', fontWeight: 600 };
const doneBtnStyle = { border: 'none', background: '#a61e4d', color: '#ffffff', fontSize: 12, fontWeight: 700, padding: '6px 16px', borderRadius: 16, cursor: 'pointer' };