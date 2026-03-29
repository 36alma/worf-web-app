'use client';

import axios from 'axios';

let isRefreshing = false;
let requestQueue: Array<() => void> = [];

const apiClient = axios.create({
  baseURL: '',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use((config) => {
  const proxyBase = process.env.NEXT_PUBLIC_API_PROXY_URL ?? '/api/proxy';
  const url = config.url ?? '';

  if (url.startsWith('/v1/')) {
    config.url = `${proxyBase}${url}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest?._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve) => {
        requestQueue.push(() => resolve(apiClient(originalRequest)));
      });
    }

    isRefreshing = true;

    try {
      await axios.post('/api/auth/token', {}, {withCredentials: true});

      requestQueue.forEach((callback) => callback());
      requestQueue = [];

      return apiClient(originalRequest);
    } catch (refreshError) {
      requestQueue = [];

      if (typeof window !== 'undefined') {
        await axios.post('/api/auth/logout', {}, {withCredentials: true}).catch(() => null);
        const locale = window.location.pathname.split('/')[1] || 'hu';
        window.location.href = `/${locale}/auth/login`;
      }

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default apiClient;
