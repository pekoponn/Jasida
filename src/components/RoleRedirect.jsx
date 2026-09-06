import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';

/** Ditaruh di route index "/" — lempar user ke dashboard sesuai rolenya. */
export default function RoleRedirect() {
  const { user, profile, loading, isAdmin } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return null; // tunggu profile kebaca dulu, hindari flicker salah redirect

  return <Navigate to={isAdmin ? '/admin' : '/lapor'} replace />;
}