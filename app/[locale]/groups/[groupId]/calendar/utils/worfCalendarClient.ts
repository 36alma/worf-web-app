'use client';

import toast from 'react-hot-toast';
import type {SupportedLocale} from '../types';

const TOKEN_KEYS = ['worf_access_token', 'access_token', 'token'];
const FORWARDED_FOR_KEYS = ['worf_client_ip', 'client_ip', 'x_forwarded_for'];

export class WorfApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'WorfApiError';
    this.status = status;
    this.data = data;
  }
}

const parseCookie = (key: string) => {
  if (typeof document === 'undefined') {
    return '';
  }

  const match = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : '';
};

export const readClientToken = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  for (const key of TOKEN_KEYS) {
    const sessionValue = window.sessionStorage.getItem(key);
    if (sessionValue?.trim()) {
      return sessionValue.trim();
    }
  }

  for (const key of TOKEN_KEYS) {
    const localValue = window.localStorage.getItem(key);
    if (localValue?.trim()) {
      return localValue.trim();
    }
  }

  for (const key of TOKEN_KEYS) {
    const cookieValue = parseCookie(key);
    if (cookieValue.trim()) {
      return cookieValue.trim();
    }
  }

  return '';
};

export const readForwardedFor = () => {
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

const parseResponsePayload = async (response: Response) => {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {message: text};
  }
};

const getErrorMessage = (status: number, data: unknown, fallbackMessage: string) => {
  if (status === 429) {
    return 'Túl sok kérés, kérjük várjon egy kicsit.';
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const detail = record.detail;
    const message = record.message;
    const error = record.error;

    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }

    if (typeof message === 'string' && message.trim()) {
      return message;
    }

    if (typeof error === 'string' && error.trim()) {
      return error;
    }
  }

  return fallbackMessage;
};

const redirectToLogin = (locale: SupportedLocale) => {
  if (typeof window === 'undefined') {
    return;
  }

  const redirectTarget = `${window.location.pathname}${window.location.search}`;
  window.location.href = `/${locale}/auth/login?redirect=${encodeURIComponent(redirectTarget)}`;
};

interface WorfFetchOptions {
  path: string;
  locale: SupportedLocale;
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  successMessage?: string;
  silentError?: boolean;
}

export async function worfFetch<T = unknown>({
  path,
  locale,
  method = 'POST',
  body,
  successMessage,
  silentError = false
}: WorfFetchOptions): Promise<T> {
  const headers = new Headers({
    'x-forwarded-for': readForwardedFor()
  });

  if (body) {
    headers.set('Content-Type', 'application/json');
  }



  const response = await fetch(`/api/proxy${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
    cache: 'no-store'
  });

  const data = await parseResponsePayload(response);



  if (response.status === 401) {
    redirectToLogin(locale);
  }

  if (!response.ok) {
    const message = getErrorMessage(response.status, data, 'A művelet nem sikerült.');

    if (!silentError) {
      toast.error(message);
    }

    throw new WorfApiError(message, response.status, data);
  }

  if (successMessage) {
    toast.success(successMessage);
  }

  return data as T;
}
