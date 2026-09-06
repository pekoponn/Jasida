import { useEffect, useState } from 'react';
import { listComments, addComment } from '../lib/reports.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

export default function CommentSection({ reportId }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
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
    <div style={wrap}>
      {loading && <p style={{ fontSize: 13, color: 'var(--color-ink-soft)' }}>Memuat komentar…</p>}

      {!loading && comments.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--color-ink-soft)' }}>Belum ada komentar.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {comments.map((c) => (
          <div key={c.id} style={{ fontSize: 13 }}>
            <span style={{ fontWeight: 700 }}>{c.profile?.username ?? 'Warga'}</span>
            {'  '}
            <span>{c.content}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={user ? 'Tulis komentar…' : 'Masuk untuk berkomentar'}
          style={inputStyle}
        />
        <button onClick={handleSend} disabled={sending} style={sendBtn}>
          Kirim
        </button>
      </div>
    </div>
  );
}

const wrap = {
  marginTop: 10,
  paddingTop: 10,
  borderTop: '1px solid var(--color-border)'
};

const inputStyle = {
  flex: 1,
  padding: '8px 12px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  fontSize: 13
};

const sendBtn = {
  padding: '8px 14px',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  background: 'var(--color-primary)',
  color: 'var(--color-primary-ink)',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer'
};