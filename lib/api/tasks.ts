import apiClient from './client';

/**
 * NOTE: All task endpoints are group-only (require group_id parameter)
 * Tasks do not have a global scope - only group-scoped tasks exist
 * Reference: system prompt section 3 - Module Scope Rules
 */

export const getTaskPanel = (data: {group_id: string; page_number?: number; load_task_number?: number; status?: string}) =>
  apiClient.post('/v1/task/panel', data);

export const getTask = (data: {group_id: string; task_id: string}) =>
  apiClient.post('/v1/task/get', data);

export const createTask = (data: {group_id: string; [key: string]: unknown}) =>
  apiClient.post('/v1/task/create', data);

export const modifyTask = (data: {group_id: string; task_id: string; [key: string]: unknown}) =>
  apiClient.post('/v1/task/modify', data);

export const deleteTask = (data: {group_id: string; task_id: string[]}) =>
  apiClient.post('/v1/task/delete', data);

export const getTaskComments = (data: {group_id: string; task_id: string}) =>
  apiClient.post('/v1/task/comment/get', data);

export const createTaskComment = (data: {group_id: string; task_id: string; text: string; [key: string]: unknown}) =>
  apiClient.post('/v1/task/comment/create', data);

export const modifyTaskComment = (data: {group_id: string; task_comment_id: string; text: string}) =>
  apiClient.post('/v1/task/comment/modify', data);

export const deleteTaskComment = (data: {group_id: string; task_comment_id: string}) =>
  apiClient.post('/v1/task/comment/delete', data);

export const createTaskCategory = (data: {group_id: string; name: string; color?: string; is_global?: boolean; [key: string]: unknown}) =>
  apiClient.post('/v1/task/category/create', data);

export const getTaskCategories = (data: {group_id: string}) =>
  apiClient.post('/v1/task/category/get', data);

export const modifyTaskCategory = (data: {group_id: string; task_category_id: string; name: string; color?: string}) =>
  apiClient.post('/v1/task/category/modify', data);

export const deleteTaskCategory = (data: {group_id: string; task_category_id: string}) =>
  apiClient.post('/v1/task/category/delete', data);

export const getTaskHistory = (data: {group_id: string; task_id: string; limit?: number}) =>
  apiClient.post('/v1/task/history/get', data);
