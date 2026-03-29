import apiClient from './client';

export const getTaskPanel = (data: {page?: number; limit?: number; scope?: string; status?: string}) =>
  apiClient.post('/v1/task/panel', data);

export const getTask = (task_id: string) => apiClient.post('/v1/task/get', {task_id});

export const modifyTask = (data: Record<string, unknown>) => apiClient.post('/v1/task/modify', data);

export const getTaskComments = (task_id: string) =>
  apiClient.post('/v1/task/comment/get', {task_id});

export const createTaskComment = (data: {task_id: string; text: string}) =>
  apiClient.post('/v1/task/comment/create', data);

export const modifyTaskComment = (data: {comment_id: string; text: string}) =>
  apiClient.post('/v1/task/comment/modify', data);

export const deleteTaskComment = (comment_id: string) =>
  apiClient.post('/v1/task/comment/delete', {comment_id});

export const createTaskCategory = (data: {name: string; color?: string}) =>
  apiClient.post('/v1/task/category/create', data);

export const getTaskCategories = () => apiClient.post('/v1/task/category/get', {});

export const modifyTaskCategory = (data: {category_id: string; name: string; color?: string}) =>
  apiClient.post('/v1/task/category/modify', data);

export const deleteTaskCategory = (category_id: string) =>
  apiClient.post('/v1/task/category/delete', {category_id});
