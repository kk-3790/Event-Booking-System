import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AccessDenied from '../pages/AccessDenied';

// Wrap any page that requires login. Optionally pass allowedRoles to
// restrict further, e.g. <ProtectedRoute allowedRoles={['ADMIN']}>
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'ORGANIZER') {
      return <Navigate to="/organizer/events" replace />;
    }
    if (user.role === 'ADMIN') {
      return <Navigate to="/admin" replace />;
    }
    return <AccessDenied allowedRoles={allowedRoles} />;
  }

  return children;
}
