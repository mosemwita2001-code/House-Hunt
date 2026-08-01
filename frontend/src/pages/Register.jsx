import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';

export default function Register() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'tenant' });
  const [formError, setFormError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!formData.name.trim() || !formData.email.trim() || !formData.password) {
      setFormError('Please fill in all required fields first.');
      return;
    }
    try {
      // This sends the data to http://localhost:5000/api/auth/register
      await API.post('/auth/register', formData);
      alert('Registration successful! Please login.');
      navigate('/login');
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow-md rounded">
      <h2 className="text-2xl font-bold mb-4">Register</h2>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <input type="text" placeholder="Name" className="w-full border p-2" onChange={(e) => setFormData({...formData, name: e.target.value})} />
        <input type="email" placeholder="Email" className="w-full border p-2" onChange={(e) => setFormData({...formData, email: e.target.value})} />
        <input type="password" placeholder="Password" className="w-full border p-2" onChange={(e) => setFormData({...formData, password: e.target.value})} />
        <select className="w-full border p-2" onChange={(e) => setFormData({...formData, role: e.target.value})}>
          <option value="tenant">Tenant</option>
          <option value="landlord">Landlord</option>
        </select>
        {formError && <p className="text-sm text-red-600" role="alert">{formError}</p>}
        <button type="submit" className="w-full bg-blue-600 text-white p-2">Register</button>
      </form>
    </div>
  );
}
