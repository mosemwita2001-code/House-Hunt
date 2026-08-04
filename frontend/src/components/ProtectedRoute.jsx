import { useContext, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function ProtectedRoute({ children, roleRequired }) {
  const { user } = useContext(AuthContext);
  const location = useLocation();

  useEffect(() => {
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.content = location.pathname === '/admin' || location.pathname === '/landlord' ? 'noindex,nofollow,noarchive' : 'index,follow';
  }, [location.pathname]);

  // 1. If not logged in, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 2. If a specific role is required, check it
  if (roleRequired && user.role !== roleRequired && !(roleRequired === 'landlord' && user.role === 'admin')) {
    return <Navigate to="/" replace />;
  }

  // 3. If everything is fine, show the protected content
  return children;
}
