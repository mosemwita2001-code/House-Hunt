import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function ProtectedRoute({ children, roleRequired }) {
  const { user } = useContext(AuthContext);

  // 1. If not logged in, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 2. If a specific role is required, check it
  if (roleRequired && user.role !== roleRequired) {
    return <Navigate to="/" replace />;
  }

  // 3. If everything is fine, show the protected content
  return children;
}