import axios from 'axios';

// Variável base, mapeando para o .env local
const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para injetar o Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('@projetoG:token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para capturar expirados ou não autorizados globalmente
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Evita loops infinitos se já estiver no login
      if (window.location.pathname !== '/login') {
        localStorage.removeItem('@projetoG:token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
