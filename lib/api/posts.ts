import apiClient from './client';

type PostPanelPayload = {
  page_number?: number;
  load_post_number?: number;
};

type GroupPostPanelPayload = PostPanelPayload & {
  group_id: string;
};

type PostCategoryQueryPayload = {
  post_category_id?: string;
  name?: string;
  description?: string;
  created_by?: string;
  limit?: number;
};

type GroupPostCategoryQueryPayload = PostCategoryQueryPayload & {
  group_id: string;
};

export const getGlobalPosts = ({ page_number = 1, load_post_number = 50 }: PostPanelPayload = {}) =>
  apiClient.post('/v1/global/post/panel', { page_number, load_post_number });

export const getGlobalPost = (post_id: string) => apiClient.post('/v1/global/post/get', { post_id });

export const createGlobalPost = (data: { title: string; body: string; category_id?: string; status?: string }) =>
  apiClient.post('/v1/global/post/create', {
    title: data.title,
    content: data.body,
    ...(data.status ? { status: data.status } : {}),
    ...(data.category_id ? { category_id: data.category_id } : {})
  });

export const deleteGlobalPost = (post_id: string) =>
  apiClient.post('/v1/global/post/delete', { post_id: [post_id] });

export const getGroupPosts = ({ group_id, page_number = 1, load_post_number = 50 }: GroupPostPanelPayload) =>
  apiClient.post('/v1/group/post/panel', { group_id, page_number, load_post_number });

export const getGroupPost = (group_id: string, post_id: string) =>
  apiClient.post('/v1/group/post/get', { group_id, post_id });

export const createGroupPost = (data: { group_id: string; title: string; body: string; category_id?: string; status?: string }) =>
  apiClient.post('/v1/group/post/create', {
    group_id: data.group_id,
    title: data.title,
    content: data.body,
    ...(data.status ? { status: data.status } : {}),
    ...(data.category_id ? { category_id: data.category_id } : {})
  });

export const deleteGroupPost = (group_id: string, post_id: string) =>
  apiClient.post('/v1/group/post/delete', { group_id, post_id: [post_id] });

export const modifyGroupPost = (data: {
  group_id: string;
  post_id: string;
  title?: string;
  body?: string;
  category_id?: string;
  is_global?: boolean;
  author_id?: string;
  status?: string;
}) => {
  const payload: {
    group_id: string;
    post_id: string;
    title?: string;
    content?: string;
    category_id?: string;
    is_global?: boolean;
    author_id?: string;
    status?: string;
  } = {
    group_id: data.group_id,
    post_id: data.post_id
  };

  if (typeof data.title === 'string') {
    payload.title = data.title;
  }

  if (typeof data.body === 'string') {
    payload.content = data.body;
  }

  if (typeof data.category_id === 'string' && data.category_id) {
    payload.category_id = data.category_id;
  }

  // WORF rule: is_global MUST be false on group endpoints — true is rejected by backend.
  // We omit it entirely (backend defaults to false) or explicitly set false.
  if (typeof data.is_global === 'boolean') {
    payload.is_global = false;
  }

  if (typeof data.author_id === 'string' && data.author_id) {
    payload.author_id = data.author_id;
  }

  if (typeof data.status === 'string' && data.status) {
    payload.status = data.status;
  }

  return apiClient.post('/v1/group/post/modify', payload);
};

export const modifyGlobalPost = (data: {
  post_id: string;
  title?: string;
  body?: string;
  category_id?: string;
  is_global?: boolean;
  author_id?: string;
  status?: string;
}) => {
  const payload: {
    post_id: string;
    title?: string;
    content?: string;
    category_id?: string;
    is_global?: boolean;
    author_id?: string;
    status?: string;
  } = {
    post_id: data.post_id
  };

  if (typeof data.title === 'string') {
    payload.title = data.title;
  }

  if (typeof data.body === 'string') {
    payload.content = data.body;
  }

  if (typeof data.category_id === 'string' && data.category_id) {
    payload.category_id = data.category_id;
  }

  if (typeof data.is_global === 'boolean') {
    payload.is_global = data.is_global;
  }

  if (typeof data.author_id === 'string' && data.author_id) {
    payload.author_id = data.author_id;
  }

  if (typeof data.status === 'string' && data.status) {
    payload.status = data.status;
  }

  return apiClient.post('/v1/global/post/modify', payload);
};

export const getGlobalPostCategories = (data: PostCategoryQueryPayload = {}) =>
  apiClient.post('/v1/global/post/category/get', data);

export const createGlobalPostCategory = (data: { name: string; description: string }) =>
  apiClient.post('/v1/global/post/category/create', data);

export const modifyGlobalPostCategory = (data: {
  post_category_id: string;
  name?: string;
  description?: string;
}) => apiClient.post('/v1/global/post/category/modify', data);

export const deleteGlobalPostCategory = (post_category_id: string) =>
  apiClient.post('/v1/global/post/category/delete', { post_category_id });

export const getGroupPostCategories = ({ group_id, ...filters }: GroupPostCategoryQueryPayload) =>
  apiClient.post('/v1/group/post/category/get', { group_id, ...filters });

export const createGroupPostCategory = (data: { group_id: string; name: string; description: string }) =>
  apiClient.post('/v1/group/post/category/create', data);

export const modifyGroupPostCategory = (data: {
  group_id: string;
  post_category_id: string;
  name?: string;
  description?: string;
}) => apiClient.post('/v1/group/post/category/modify', data);

export const deleteGroupPostCategory = (group_id: string, post_category_id: string) =>
  apiClient.post('/v1/group/post/category/delete', { group_id, post_category_id });
