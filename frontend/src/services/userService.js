import API from './api';

export const fetchUsers = () => API.get('/admin/users');
export const getAllUsers = () => API.get('/admin/users');
export const deleteUser = (id) => API.delete(`/admin/users/${id}`);
