/** Error classes and helpers for calendar API failures and notifications. */
import toast from 'react-hot-toast';

export class CalendarApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'CalendarApiError';
    this.status = status;
    this.details = details;
  }
}

export class AuthenticationError extends CalendarApiError {}
export class PermissionDeniedError extends CalendarApiError {}
export class NotFoundError extends CalendarApiError {}
export class ValidationError extends CalendarApiError {}
export class RateLimitError extends CalendarApiError {
  retryAfterMs?: number;
  constructor(message: string, details?: unknown, retryAfterMs?: number) {
    super(message, 429, details);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export function mapHttpError(status: number, message: string, details?: unknown): CalendarApiError {
  if (status === 401) return new AuthenticationError(message, status, details);
  if (status === 403) return new PermissionDeniedError(message, status, details);
  if (status === 404) return new NotFoundError(message, status, details);
  if (status === 422) return new ValidationError(message, status, details);
  if (status === 429) return new RateLimitError(message, details);
  return new CalendarApiError(message, status, details);
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected calendar error.';
}

export function notifyError(error: unknown): void {
  toast.error(getErrorMessage(error));
}

export function notifySuccess(message: string): void {
  toast.success(message);
}
