import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';

export default function RoleRedirect() {
  const { user, profile, loading, isAdmin } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return null;

  return <Navigate to={isAdmin ? '/admin' : '/lapor'} replace />;
}