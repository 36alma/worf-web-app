import apiClient from './client';

export const getGlobalPosts = (data: {page?: number; limit?: number}) =>
  apiClient.post('/v1/global/post/panel', data);

export const getGlobalPost = (post_id: string) => apiClient.post('/v1/global/post/get', {post_id});

export const createGlobalPost = (data: {title: string; body: string}) =>
  apiClient.post('/v1/global/post/create', data);

export const deleteGlobalPost = (post_id: string) =>
  apiClient.post('/v1/global/post/delete', {post_id});

export const getGroupPosts = (data: {group_id: string; page?: number; limit?: number}) =>
  apiClient.post('/v1/group/post/panel', data);

export const getGroupPost = (group_id: string, post_id: string) =>
  apiClient.post('/v1/group/post/get', {group_id, post_id});

export const createGroupPost = (data: {group_id: string; title: string; body: string}) =>
  apiClient.post('/v1/group/post/create', data);

export const deleteGroupPost = (group_id: string, post_id: string) =>
  apiClient.post('/v1/group/post/delete', {group_id, post_id});
