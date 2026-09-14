import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';

export default function AdminRoute({ children }) {
  const { user, profile, loading, isAdmin } = useAuth();

  if (loading) return null;

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/lapor" replace />;

  return children;
}