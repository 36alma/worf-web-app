import apiClient from './client';
import type {
  InboxActionRequest,
  InboxActionResponse,
  InboxListParams,
  InboxListResponse,
  PreferenceChange,
  PreferencesResponse
} from '@/lib/types/notifications';

export const getNotificationPreferences = () => apiClient.post<PreferencesResponse>('/v1/notification/preferences/get', {});

/**
 * Bulk change, one transaction: all-or-nothing, idempotent. Max 200 entries.
 * 422: unknown/non-configurable type, a channel the type doesn't support, an invalid or non-own `group_id`, or an
 * empty/too-long `changes` array. 409: the caller is already over the 1000-exception cap.
 */
export const setNotificationPreferences = (data: {changes: PreferenceChange[]}) =>
  apiClient.post<PreferencesResponse>('/v1/notification/preferences/set', data);

/** Without `group_id` every exception is cleared (everything turns back on); with it, only that group's. */
export const resetNotificationPreferences = (data: {group_id?: string} = {}) =>
  apiClient.post<PreferencesResponse>('/v1/notification/preferences/reset', data);

export const listInbox = (data: InboxListParams) => apiClient.post<InboxListResponse>('/v1/notification/inbox/list', data);

/** Unread, non-archived, currently-visible item count — for the bell badge. */
export const countInboxUnread = () => apiClient.post<{unread: number}>('/v1/notification/inbox/count', {});

/**
 * `OPEN` marks the item read and returns where to navigate (`target`). `ACCEPT`/`DECLINE` (event invitations) is
 * handled entirely server-side here — never also call the calendar `invite/respond` endpoint for it.
 * Errors: 404 — item is gone/not-own, drop it from the list; 422 — no such action on this item; 403 — no
 * permission, patch `action.status` to `FORBIDDEN`; 409 — already resolved/expired, patch `action.status` from the
 * response (`COMPLETED`/`EXPIRED`).
 */
export const actionInboxItem = (data: InboxActionRequest) => apiClient.post<InboxActionResponse>('/v1/notification/inbox/action', data);

/** Max 100 ids per call, or `{all: true}` for everything. An unknown/foreign id is silently ignored, not an error. */
export const markInboxRead = (data: {notification_ids: string[]; read: boolean} | {all: true; read: boolean}) =>
  apiClient.post<{updated: number}>('/v1/notification/inbox/read', data);

/** Max 100 ids per call. */
export const archiveInboxItems = (data: {notification_ids: string[]; archived: boolean}) =>
  apiClient.post<{updated: number}>('/v1/notification/inbox/archive', data);

/** Max 100 ids per call. Soft delete — the server purges it permanently after 30 days. */
export const deleteInboxItems = (data: {notification_ids: string[]}) =>
  apiClient.post<{updated: number}>('/v1/notification/inbox/delete', data);
