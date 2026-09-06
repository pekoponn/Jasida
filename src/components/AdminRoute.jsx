import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';

/** Bungkus route admin dengan ini. Non-admin dilempar balik ke /report. */
export default function AdminRoute({ children }) {
  const { user, profile, loading, isAdmin } = useAuth();

  if (loading) return null; // atau spinner, sesuaikan sama pola loading kamu yang lain

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/lapor" replace />;

  return children;
}