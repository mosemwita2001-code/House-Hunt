import axios from 'axios';

// 1. Create the base instance
const API = axios.create({
  baseURL: 'http://localhost:5000/api'
});

// 2. Interceptor to attach the token automatically to every request
API.interceptors.request.use(
  (config) => {
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (user && user.token) {
      config.headers.Authorization = `Bearer ${user.token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 3. Interceptor to handle expired tokens or authentication errors (401)
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRequest = error.config?.url?.startsWith('/auth/');

    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 4. API Service Functions
export const getDashboardStats = () => API.get('/admin/stats');

// User Management
export const getAllUsers = () => API.get('/admin/users');
export const updateUserStatus = (id, status) => API.patch(`/admin/users/${id}/status`, { status });
export const deleteUser = (id) => API.delete(`/admin/users/${id}`);

// Listing Management
export const getAllListings = () => API.get('/admin/listings');
export const updateListingStatus = (id, status) => API.patch(`/admin/listings/${id}/status`, { status });
export const deleteListing = (id) => API.delete(`/admin/listings/${id}`);

export default API;
