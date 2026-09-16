import { Navigate } from 'react-router-dom';
import RoleRedirect from './RoleRedirect.jsx';
import { useAuth } from '../lib/AuthContext.jsx';

export default function AdminRoute({ children }) {
  const { user, profile, loading, isAdmin } = useAuth();

  if (loading) return <p role="status">Memuat akun…</p>;

  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <RoleRedirect />;
  if (!isAdmin) return <Navigate to="/lapor" replace />;

  return children;
}
