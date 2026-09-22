import apiClient from './client';
import type {
  ActivityParams,
  ActivityResponse,
  DashboardSummary,
  TaskPanelAllParams,
  TaskPanelAllResponse,
  UpcomingEventsParams,
  UpcomingEventsResponse
} from '@/lib/types/dashboard';

/**
 * Cross-group, user-scoped endpoints behind the dashboard (docs/dashboard-api.md). No `group_id` goes in: the server
 * answers from every group the caller may read and silently skips the rest — never a 403 for the whole request.
 * The proxy adds the Bearer token.
 */

export const getDashboardSummary = () => apiClient.post<DashboardSummary>('/v1/dashboard/summary', {});

/** `scope` defaults to `assigned_to_me` server-side. */
export const listAllTasks = (data: TaskPanelAllParams = {}) =>
  apiClient.post<TaskPanelAllResponse>('/v1/task/panel/all', data);

export const listUpcomingEvents = (data: UpcomingEventsParams = {}) =>
  apiClient.post<UpcomingEventsResponse>('/v1/group/calendar/upcoming/all', data);

export const getDashboardActivity = (data: ActivityParams = {}) =>
  apiClient.post<ActivityResponse>('/v1/dashboard/activity', data);
