import {
  Bell,
  CheckCheck,
  CheckCircle2,
  FilePlus2,
  MapPin,
  ShieldCheck,
  Wrench,
  XCircle,
} from 'lucide-react';

function iconFor(type) {
  if (type === 'report_new') return { Icon: FilePlus2, color: '#1c5dcf', bg: '#E7F1FF' };
  if (type?.startsWith('review_')) return { Icon: ShieldCheck, color: '#5F3DC4', bg: '#E7DFFB' };
  if (type === 'status_accepted') return { Icon: CheckCircle2, color: '#1c5dcf', bg: '#E7F1FF' };
  if (type === 'status_in_progress') return { Icon: Wrench, color: '#1c7ed6', bg: '#E3F1FD' };
  if (type === 'status_resolved') return { Icon: CheckCircle2, color: '#1c8a4b', bg: '#E6F8EC' };
  if (type === 'status_rejected') return { Icon: XCircle, color: '#A61C24', bg: '#FDECEE' };
  if (type === 'location_verified') return { Icon: MapPin, color: '#1c8a4b', bg: '#E6F8EC' };
  if (type === 'location_rejected') return { Icon: MapPin, color: '#A61C24', bg: '#FDECEE' };
  return { Icon: Bell, color: '#868e96', bg: '#F1F3F5' };
}

export default function NotificationPanel({ items, unread, onItemClick, onReadAll, style }) {
  return (
    <div style={{ ...panel, ...style }}>
      <div style={head}>
        <strong style={{ fontSize: 14 }}>Notifikasi</strong>
        {unread > 0 && (
          <button type="button" style={readAllBtn} onClick={onReadAll}>
            <CheckCheck size={14} /> Tandai dibaca
          </button>
        )}
      </div>

      <div style={{ maxHeight: 380, overflowY: 'auto' }}>
        {items.length === 0 && (
          <div style={empty}>
            <Bell size={28} color="#ced4da" />
            <div style={{ marginTop: 8 }}>Belum ada notifikasi.</div>
          </div>
        )}
        {items.map((n) => {
          const { Icon, color, bg } = iconFor(n.type);
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => onItemClick(n)}
              style={{ ...itemBtn, background: n.read_at ? '#fff' : '#FDF3F4' }}
            >
              <span style={{ ...iconWrap, background: bg, color }}>
                <Icon size={16} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 13 }}>{n.title}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: '#495057', marginTop: 2 }}>
                  {n.body}
                </span>
                <span style={{ display: 'block', fontSize: 11, color: '#adb5bd', marginTop: 4 }}>
                  {new Date(n.created_at).toLocaleString('id-ID')}
                </span>
              </span>
              {!n.read_at && <span style={dot} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const panel = {
  width: 340,
  maxWidth: '90vw',
  background: '#fff',
  borderRadius: 14,
  boxShadow: '0 8px 28px rgba(25,27,31,0.18)',
  overflow: 'hidden',
};
const head = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 14px',
  borderBottom: '1px solid #f1f3f5',
};
const readAllBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  border: 'none',
  background: 'none',
  color: '#A61C24',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};
const empty = {
  padding: 32,
  textAlign: 'center',
  color: '#868e96',
  fontSize: 13,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};
const itemBtn = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  width: '100%',
  textAlign: 'left',
  padding: '12px 14px',
  border: 'none',
  borderBottom: '1px solid #f1f3f5',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const iconWrap = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
const dot = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: '#A61C24',
  marginTop: 6,
  flexShrink: 0,
};