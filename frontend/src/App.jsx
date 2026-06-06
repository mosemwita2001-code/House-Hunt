import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/login';
import Register from './pages/Register';
import PropertyDetails from './pages/propertyDetails';
import LandlordDashboard from './pages/LandlordDashboard';
import AdminDashboard from './pages/AdminDashboard'; // 1. IMPORT YOUR DASHBOARD
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
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
      </Router>
    </AuthProvider>
  );
}
export default App;
