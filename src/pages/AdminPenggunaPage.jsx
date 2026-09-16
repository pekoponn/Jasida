import { useEffect, useMemo, useState } from 'react';
import { listAllUsers, updateUserRole } from '../lib/profile.js';
import { getReportCountsByUser } from '../lib/reports.js';
import { useAuth } from '../lib/AuthContext.jsx';

const ROLE_META = {
  admin: { label: 'Admin', bg: '#FDECEE', color: '#A61C24' },
  user: { label: 'Warga', bg: '#E7F1FF', color: '#1c5dcf' }
};

export default function AdminPenggunaPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [reportCounts, setReportCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [usersData, counts] = await Promise.all([listAllUsers(), getReportCountsByUser()]);
      setUsers(usersData);
      setReportCounts(counts);
    } catch (err) {
      console.error(err);
      setError('Gagal memuat daftar pengguna: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(userId, newRole) {
    setBusyId(userId);
    try {
      await updateUserRole(userId, newRole);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    } catch (err) {
      alert('Gagal mengubah role: ' + err.message);
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter && (u.role ?? 'user') !== roleFilter) return false;
      if (q && !(u.username ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [users, searchQuery, roleFilter]);

  return (
    <section>
      <h1 className="display" style={{ fontSize: 24, marginBottom: 4 }}>Kelola Pengguna</h1>
      <p style={{ color: '#868e96', marginTop: 0, fontSize: 14 }}>
        Lihat semua pengguna terdaftar dan atur siapa yang punya akses admin.
      </p>

      {error && <p style={{ color: '#e03131', marginTop: 12 }}>{error}</p>}
      {loading && <p style={{ marginTop: 12 }}>Memuat pengguna…</p>}

      {!loading && (
        <div style={panelCard}>
          <div style={toolbarRow}>
            <input
              type="text"
              placeholder="Cari nama pengguna…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={searchInputStyle}
            />
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={selectFilterStyle}>
              <option value="">Semua Role</option>
              <option value="user">Warga</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#A61C24', color: '#fff', textAlign: 'left' }}>
                  <th style={th}>Pengguna</th>
                  <th style={th}>Tanggal Bergabung</th>
                  <th style={th}>Jumlah Laporan</th>
                  <th style={th}>Role</th>
                  <th style={th}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td style={td} colSpan={5}>Tidak ada pengguna yang cocok.</td></tr>
                )}
                {filtered.map((u) => (
                  <UserRow
                    key={u.id}
                    profileUser={u}
                    reportCount={reportCounts[u.id] ?? 0}
                    busy={busyId === u.id}
                    isSelf={u.id === currentUser?.id}
                    onRoleChange={(role) => handleRoleChange(u.id, role)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function UserRow({ profileUser, reportCount, busy, isSelf, onRoleChange }) {
  const role = profileUser.role ?? 'user';
  const meta = ROLE_META[role] ?? ROLE_META.user;

  return (
    <tr style={{ borderBottom: '1px solid #eee' }}>
      <td style={td}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {profileUser.avatar_url ? (
            <img src={profileUser.avatar_url} alt="" style={avatarImg} />
          ) : (
            <span style={avatarFallback}>{(profileUser.username?.[0] ?? '?').toUpperCase()}</span>
          )}
          <div>
            <div style={{ fontWeight: 700 }}>{profileUser.username ?? '(tanpa nama)'}</div>
            {isSelf && <div style={{ fontSize: 11, color: '#868e96' }}>Ini akun kamu</div>}
          </div>
        </div>
      </td>
      <td style={td}>{profileUser.created_at ? new Date(profileUser.created_at).toLocaleDateString('id-ID') : '-'}</td>
      <td style={td}>{reportCount}</td>
      <td style={td}>
        <span style={{ ...badge, background: meta.bg, color: meta.color }}>{meta.label}</span>
      </td>
      <td style={td}>
        <select
          value={role}
          disabled={busy || isSelf}
          onChange={(e) => onRoleChange(e.target.value)}
          style={roleSelectStyle}
        >
          <option value="user">Warga</option>
          <option value="admin">Admin</option>
        </select>
      </td>
    </tr>
  );
}

const panelCard = {
  marginTop: 20,
  background: '#fff',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(25,27,31,0.06), 0 4px 16px rgba(25,27,31,0.06)',
  overflow: 'hidden'
};

const toolbarRow = {
  padding: '16px 20px',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  alignItems: 'center'
};

const searchInputStyle = {
  flex: '1 1 240px',
  padding: '9px 14px',
  borderRadius: 8,
  border: '1px solid #dee2e6',
  fontSize: 13,
  fontFamily: 'inherit'
};

const selectFilterStyle = {
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid #dee2e6',
  fontSize: 13,
  fontFamily: 'inherit',
  background: '#fff',
  color: '#333',
  cursor: 'pointer'
};

const roleSelectStyle = {
  padding: '7px 10px',
  borderRadius: 8,
  border: '1px solid #dee2e6',
  fontSize: 12.5,
  fontFamily: 'inherit',
  background: '#fff',
  cursor: 'pointer'
};

const th = { padding: '12px 16px', fontWeight: 600 };
const td = { padding: '12px 16px', verticalAlign: 'middle' };

const badge = {
  display: 'inline-block',
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 11.5,
  fontWeight: 700
};

const avatarImg = { width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 };

const avatarFallback = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  background: '#A61C24',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 13,
  fontWeight: 700,
  flexShrink: 0
};