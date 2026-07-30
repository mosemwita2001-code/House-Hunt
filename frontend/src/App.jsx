import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/login'));
const Register = lazy(() => import('./pages/Register'));
const PropertyDetails = lazy(() => import('./pages/propertyDetails'));
const LandlordDashboard = lazy(() => import('./pages/LandlordDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <Suspense fallback={<main style={{ padding: 24 }}>Loading…</main>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/property/:id" element={<PropertyDetails />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* 2. ADD THE ADMIN ROUTE */}
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute roleRequired="admin">
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/landlord" 
            element={
              <ProtectedRoute roleRequired="landlord">
                <LandlordDashboard />
              </ProtectedRoute>
            } 
          />
        </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}
export default App;
