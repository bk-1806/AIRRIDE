import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('airride_admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('airride_admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  login: (email, password) => api.post('/auth/admin/login', { email, password }),
};

export const bookingsAPI = {
  getAll: (params) => api.get('/admin/bookings', { params }),
  assignDriver: (id, data) => api.post(`/admin/bookings/${id}/assign`, data),
  updateStatus: (id, data) => api.put(`/admin/bookings/${id}/status`, data),
};

export const driversAPI = {
  getAll: (params) => api.get('/admin/drivers', { params }),
};

export const usersAPI = {
  getAll: (params) => api.get('/admin/users', { params }),
};

export const analyticsAPI = {
  get: () => api.get('/admin/analytics'),
};

export default api;
