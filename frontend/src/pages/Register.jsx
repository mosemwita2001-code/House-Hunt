import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { getRegistrationErrorMessage } from '../utils/registrationError';

export default function Register() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'tenant', terms_accepted: false });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!formData.name.trim() || !formData.email.trim() || !formData.password) {
      setFormError('Please fill in all required fields first.');
      return;
    }
    if (!formData.terms_accepted) {
      setFormError('You must accept the Terms & Conditions and Privacy Policy to create an account.');
      return;
    }
    setSubmitting(true);
    try {
      // Submit the registration form.
      await API.post('/auth/register', formData);
      alert('Registration successful! Please login.');
      navigate('/login');
    } catch (err) {
      console.error(err);
      setFormError(getRegistrationErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow-md rounded">
      <h2 className="text-2xl font-bold mb-4">Register</h2>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <label htmlFor="register-name">Full name</label>
        <input id="register-name" name="name" type="text" autoComplete="name" placeholder="Name" className="w-full border p-2" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
        <label htmlFor="register-email">Email address</label>
        <input id="register-email" name="email" type="email" autoComplete="email" placeholder="Email" className="w-full border p-2" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
        <label htmlFor="register-password">Password</label>
        <input id="register-password" name="password" type="password" autoComplete="new-password" placeholder="Password" className="w-full border p-2" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
        <label htmlFor="register-role">Account type</label>
        <select id="register-role" name="role" className="w-full border p-2" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}>
          <option value="tenant">Tenant</option>
          <option value="landlord">Landlord</option>
        </select>
        <label htmlFor="register-terms" className="flex items-start gap-2 text-sm leading-5 text-slate-600">
          <input id="register-terms" name="terms_accepted" type="checkbox" required className="mt-1" checked={formData.terms_accepted} onChange={(e) => setFormData({...formData, terms_accepted: e.target.checked})} />
          <span>
            I have read and agree to the <Link to="/terms" className="text-brand hover:text-brand-dark">Terms &amp; Conditions</Link> and <Link to="/privacy-policy" className="text-brand hover:text-brand-dark">Privacy Policy</Link>.
          </span>
        </label>
        {formError && <p className="text-sm text-red-600" role="alert">{formError}</p>}
        <button type="submit" disabled={submitting} aria-busy={submitting} className="flex w-full items-center justify-center gap-2 bg-blue-600 text-white p-2 disabled:cursor-not-allowed disabled:opacity-70">
          {submitting && <LoadingSpinner size={16} />}
          {submitting ? 'Creating account...' : 'Register'}
        </button>
        <p className="text-center text-xs leading-5 text-slate-500">
          By signing up, you agree to our <Link to="/terms" className="text-brand hover:text-brand-dark">Terms and Conditions</Link> and <Link to="/privacy-policy" className="text-brand hover:text-brand-dark">Privacy Policy</Link>
        </p>
      </form>
    </div>
  );
}
