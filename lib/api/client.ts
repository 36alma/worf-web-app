// worf-app/lib/api/client.ts
import axios from 'axios'

const baseURL = typeof window === 'undefined'
  ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/proxy`
  : '/api/proxy'

const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Client IP utility for WORF backend
const FORWARDED_FOR_KEYS = ['worf_client_ip', 'client_ip', 'x_forwarded_for'];

const parseCookie = (key: string) => {
  if (typeof document === 'undefined') {
    return '';
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : '';
};

const readForwardedFor = () => {
  if (typeof window === 'undefined') {
    return '127.0.0.1';
  }
  for (const key of FORWARDED_FOR_KEYS) {
    const sessionValue = window.sessionStorage.getItem(key);
    if (sessionValue?.trim()) {
      return sessionValue.trim();
    }
  }
  for (const key of FORWARDED_FOR_KEYS) {
    const cookieValue = parseCookie(key);
    if (cookieValue.trim()) {
      return cookieValue.trim();
    }
  }
  if (window.location.hostname?.trim()) {
    return window.location.hostname;
  }
  return '127.0.0.1';
};

// Inject Bearer token from cookie or session on every request
apiClient.interceptors.request.use((config) => {
  // Check and append x-forwarded-for header (Mandatory WORF feature)
  if (typeof window !== 'undefined') {
    config.headers['x-forwarded-for'] = readForwardedFor();
  }

  // token injection is handled by /api/proxy — nothing needed here
  return config
})

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

// Exclusively returning promise rejection to allow silent failures on UI components
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Ha a válasz 401, és még nem próbáltuk újra
    if (error.response?.status === 401 && !originalRequest._retry && typeof window !== 'undefined') {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => apiClient(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Frissítjük a tokent a dedikált szerveres végponton
        await axios.post('/api/auth/token');
        
        isRefreshing = false;
        processQueue(null);
        
        // Ismételjük meg az eredeti kérést
        return apiClient(originalRequest);
      } catch (err) {
        isRefreshing = false;
        processQueue(err);
        
        // Ha lejárt, vagy nem sikerült, irányítsuk a loginra
        const locale = window.location.pathname.split('/')[1] || 'hu';
        window.location.href = `/${locale}/auth/login`;
        return Promise.reject(err);
      }
    }

    // Egy 403 kétféle lehet: szerepkör-alapú tiltás, vagy a tokenből hiányzó
    // scope. A proxy csak az utóbbihoz teszi be az insufficient_scope mezőt.
    if (error.response?.status === 403) {
      const payload = error.response.data as {error?: string; required_scope?: string} | undefined;
      if (payload?.error === 'insufficient_scope') {
        error.isInsufficientScope = true;
        error.requiredScope = payload.required_scope;
      }
    }

    return Promise.reject(error);
  }
)

export default apiClient
