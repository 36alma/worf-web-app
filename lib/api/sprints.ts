import apiClient from './client';

/**
 * NOTE: Sprint endpoints are group-only (require group_id parameter),
 * mirroring the task endpoints - see lib/api/tasks.ts.
 */

export const getSprintList = (data: {group_id: string; limit?: number}) =>
  apiClient.post('/v1/sprint/list', data);

export const getSprint = (data: {group_id: string; sprint_id: string}) =>
  apiClient.post('/v1/sprint/get', data);

export const createSprint = (data: {group_id: string; sprint_name: string; sprint_goal?: string; start_date: string; end_date: string}) =>
  apiClient.post('/v1/sprint/create', data);

export const modifySprint = (data: {group_id: string; sprint_id: string; [key: string]: unknown}) =>
  apiClient.post('/v1/sprint/modify', data);

export const deleteSprint = (data: {group_id: string; sprint_id: string}) =>
  apiClient.post('/v1/sprint/delete', data);

export const startSprint = (data: {group_id: string; sprint_id: string}) =>
  apiClient.post('/v1/sprint/start', data);

export const closeSprint = (data: {group_id: string; sprint_id: string}) =>
  apiClient.post('/v1/sprint/close', data);
