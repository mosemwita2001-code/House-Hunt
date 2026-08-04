import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/login'));
const Register = lazy(() => import('./pages/Register'));
const PropertyDetails = lazy(() => import('./pages/propertyDetails'));
const LandlordDashboard = lazy(() => import('./pages/LandlordDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Terms = lazy(() => import('./pages/Terms'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));

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
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
          
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
        <Footer />
      </Router>
    </AuthProvider>
  );
}
export default App;
