import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import API from '../services/api';

export default function Login() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // 1. Sends request to http://localhost:5000/api/auth/login
      const res = await API.post('/auth/login', formData); //
      
      // 2. CRITICAL: Save token and user data to localStorage so api.js interceptor can attach it
      localStorage.setItem('user', JSON.stringify({ 
        token: res.data.token, 
        ...res.data.user 
      }));
      
      // 3. Save token/user info to global application context
      login(res.data.token, res.data.user); //
      
      // 4. Redirect based on role fetched from MySQL database
      if (res.data.user.role === 'admin') {
        navigate('/admin'); 
      } else if (res.data.user.role === 'landlord') {
        navigate('/landlord'); //
      } else {
        navigate('/'); //
      }
    } catch (err) {
      console.error(err); //
      // Uses the 'message' key which matches server.js response format
      alert(err.response?.data?.message || 'Login failed. Check your credentials.'); //
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow-md rounded">
      <h2 className="text-2xl font-bold mb-4">Login</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input 
          type="email" 
          placeholder="Email" 
          className="w-full border p-2" 
          onChange={(e) => setFormData({...formData, email: e.target.value})} 
          required 
        />
        <input 
          type="password" 
          placeholder="Password" 
          className="w-full border p-2" 
          onChange={(e) => setFormData({...formData, password: e.target.value})} 
          required 
        />
        <button type="submit" className="w-full bg-green-600 text-white p-2">Login</button>
      </form>
    </div>
  );
}