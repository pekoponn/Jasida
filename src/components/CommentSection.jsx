import { useEffect, useState } from 'react';
import { listComments, addComment } from '../lib/reports.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const AVATAR_COLORS = ['#E8A93B', '#E0561F', '#191B1F'];

export default function CommentSection({ reportId, photoUrl }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    listComments(reportId)
      .then(setComments)
      .catch((err) => console.warn('[comments]', err.message))
      .finally(() => setLoading(false));
  }, [reportId]);

  async function handleSend() {
    if (!user) {
      navigate('/login');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const newComment = await addComment(reportId, trimmed);
      setComments((prev) => [...prev, { ...newComment, profile: { username: 'Kamu' } }]);
      setText('');
    } catch (err) {
      console.warn('[comment-send]', err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rw-btn-anim" style={triggerBtn}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
          <path d="M21 11.5a8.5 8.5 0 1 1-3.8-7.1L21 3l-1 4.3a8.4 8.4 0 0 1 1 4.2z" />
        </svg>
        <span style={{ fontWeight: 700 }}>{loading ? '…' : comments.length}</span>
      </button>
      
      {open && (
        <div style={overlay} role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div style={panel} onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setOpen(false)} style={closeBtn} aria-label="Tutup">✕</button>

            {photoUrl && (
              <img src={photoUrl} alt="Foto laporan" style={panelPhoto} />
            )}

            <div style={commentListWrap}>
              {loading && <p style={{ fontSize: 13, color: '#868e96' }}>Memuat komentar…</p>}
              {!loading && comments.length === 0 && (
                <p style={{ fontSize: 13, color: '#868e96' }}>Belum ada komentar.</p>
              )}
              {comments.map((c, i) => {
                const name = c.profile?.username?.trim() || 'Anonim';
                const initial = name[0]?.toUpperCase() ?? 'A';
                const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                    <span style={{ ...commentAvatar, backgroundColor: color }}>{initial}</span>
                    <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                      <span style={{ fontWeight: 700 }}>{name}</span>{'  '}
                      <span>{c.content}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 8, padding: '10px 16px 16px', borderTop: '1px solid #eee' }}>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={user ? 'Tulis komentar…' : 'Masuk untuk berkomentar'}
                style={inputStyle}
              />
              <button onClick={handleSend} disabled={sending} className="rw-btn-anim" style={sendBtn}>
                Kirim <span aria-hidden="true">➤</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const triggerBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  border: 'none',
  background: '#f1f3f5',
  color: '#495057',
  fontWeight: 700,
  fontSize: 11,
  cursor: 'pointer',
  padding: '5px 12px',
  borderRadius: 20,
  whiteSpace: 'nowrap'
};

const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(25,27,31,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 100
};

const panel = {
  width: '100%',
  maxWidth: 480,
  maxHeight: '85vh',
  background: '#fff',
  borderRadius: 16,
  boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};

const closeBtn = {
  position: 'absolute',
  top: 10,
  right: 10,
  width: 28,
  height: 28,
  borderRadius: '50%',
  border: 'none',
  background: 'rgba(0,0,0,0.5)',
  color: '#fff',
  fontSize: 14,
  cursor: 'pointer',
  zIndex: 2
};

const panelPhoto = {
  width: '100%',
  maxHeight: 260,
  objectFit: 'cover',
  display: 'block',
  flexShrink: 0
};

const commentListWrap = {
  padding: '14px 16px',
  overflowY: 'auto',
  flex: 1
};

const commentAvatar = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  color: '#ffffff',
  fontSize: 10,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  marginTop: 1
};

const inputStyle = {
  flex: 1,
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #dee2e6',
  fontSize: 13
};

const sendBtn = {
  padding: '8px 14px',
  borderRadius: 8,
  border: 'none',
  background: '#a61e4d',
  color: '#fff',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  whiteSpace: 'nowrap'
};