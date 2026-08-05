import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import API from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Login() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!formData.email.trim() || !formData.password) {
      setFormError('Please enter your email and password first.');
      return;
    }
    setSubmitting(true);
    try {
      // 1. Submit the login form.
      const res = await API.post('/auth/login', formData); //
      
      // 2. CRITICAL: Save token and user data to localStorage so api.js interceptor can attach it
      localStorage.setItem('user', JSON.stringify({ 
        token: res.data.token, 
        ...res.data.user 
      }));
      
      // 3. Save token/user info to global application context
      login(res.data.token, res.data.user); //
      
      // 4. Redirect based on the authenticated role
      if (res.data.user.role === 'admin') {
        navigate('/admin'); 
      } else if (res.data.user.role === 'landlord') {
        navigate('/landlord'); //
      } else {
        navigate('/'); //
      }
    } catch (err) {
      console.error(err); //
      // Display the message returned by the login request.
      setFormError(err.response?.data?.message || 'Login failed. Check your credentials.'); //
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow-md rounded">
      <h2 className="text-2xl font-bold mb-4">Login</h2>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <label htmlFor="login-email">Email address</label>
        <input 
          type="email" 
          id="login-email"
          name="email"
          value={formData.email}
          autoComplete="email"
          placeholder="Email" 
          className="w-full border p-2" 
          onChange={(e) => setFormData({...formData, email: e.target.value})} 
        />
        <label htmlFor="login-password">Password</label>
        <input 
          type="password" 
          id="login-password"
          name="password"
          value={formData.password}
          autoComplete="current-password"
          placeholder="Password" 
          className="w-full border p-2" 
          onChange={(e) => setFormData({...formData, password: e.target.value})} 
        />
        {formError && <p className="text-sm text-red-600" role="alert">{formError}</p>}
        <button type="submit" disabled={submitting} aria-busy={submitting} className="flex w-full items-center justify-center gap-2 bg-green-600 text-white p-2 disabled:cursor-not-allowed disabled:opacity-70">
          {submitting && <LoadingSpinner size={16} />}
          {submitting ? 'Signing in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
