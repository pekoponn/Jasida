import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';

export default function RoleRedirect() {
  const { user, profile, loading, isAdmin, refreshProfile } = useAuth();

  if (loading) return <p role="status">Memuat akun…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile)
    return (
      <div role="alert">
        <p>Profil belum dapat dimuat. Coba lagi.</p>
        <button onClick={refreshProfile}>Muat ulang profil</button>
      </div>
    );

  return <Navigate to={isAdmin ? '/admin' : '/lapor'} replace />;
}
