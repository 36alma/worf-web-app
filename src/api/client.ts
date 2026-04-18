/** Shared HTTP client with body Bearer injection, x-forwarded-for and retry support. */
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { mapHttpError } from '@/src/utils/errorHandler';

export interface ApiClientOptions {
  baseURL?: string;
  getToken?: () => string | null;
  getClientIp?: () => string;
  onLoadingChange?: (loading: boolean) => void;
  onRequestLog?: (config: AxiosRequestConfig) => void;
  onResponseLog?: (response: AxiosResponse) => void;
}

export class ApiClient {
  readonly axios: AxiosInstance;
  private readonly getToken?: () => string | null;
  private readonly getClientIp?: () => string;
  private readonly onLoadingChange?: (loading: boolean) => void;
  private inflight = 0;

  constructor(options: ApiClientOptions = {}) {
    this.getToken = options.getToken;
    this.getClientIp = options.getClientIp;
    this.onLoadingChange = options.onLoadingChange;
    this.axios = axios.create({
      baseURL: options.baseURL ?? '',
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });

    this.axios.interceptors.request.use((config) => {
      const proxyBase =
        typeof window !== 'undefined'
          ? '/api/proxy'
          : process.env.NEXT_PUBLIC_API_PROXY_URL ?? '/api/proxy';
      const url = config.url ?? '';
      if (url.startsWith('/v1/')) {
        config.url = `${proxyBase}${url}`;
      }

      const ip = this.getClientIp?.() ?? '127.0.0.1';
      config.headers = {
        ...(config.headers ?? {}),
        'x-forwarded-for': ip
      } as never;

      const token = this.getToken?.();
      if (token) {
        const currentData = (config.data && typeof config.data === 'object' ? config.data : {}) as Record<string, unknown>;
        if (typeof currentData.Bearer !== 'string' || currentData.Bearer.length === 0) {
          config.data = { ...currentData, Bearer: token };
        }
      }

      options.onRequestLog?.(config);
      this.inflight += 1;
      this.onLoadingChange?.(this.inflight > 0);
      return config;
    });

    this.axios.interceptors.response.use(
      (response) => {
        options.onResponseLog?.(response);
        this.inflight = Math.max(0, this.inflight - 1);
        this.onLoadingChange?.(this.inflight > 0);
        return response;
      },
      (error: AxiosError) => {
        this.inflight = Math.max(0, this.inflight - 1);
        this.onLoadingChange?.(this.inflight > 0);
        return Promise.reject(error);
      }
    );
  }

  /** Executes request with 429 exponential backoff retry. */
  async postWithRetry<TResponse, TBody>(
    path: string,
    body: TBody,
    maxRetries = 3
  ): Promise<TResponse> {
    let attempt = 0;
    while (true) {
      try {
        const response = await this.axios.post<TResponse>(path, body);
        return response.data;
      } catch (reason) {
        const error = reason as AxiosError<{ message?: string; error?: string }>;
        const status = error.response?.status ?? 500;
        const backendMessage = error.response?.data?.message ?? error.response?.data?.error;
        const message = backendMessage ?? error.message ?? 'Calendar request failed';
        const retryable = status === 429;

        if (!retryable || attempt >= maxRetries) {
          throw mapHttpError(status, message, error.response?.data);
        }

        const delayMs = Math.min(1000 * 2 ** attempt, 8000);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        attempt += 1;
      }
    }
  }
}
