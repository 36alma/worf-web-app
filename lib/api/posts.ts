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

export const createGlobalPost = (data: { title: string; body: string; category_id?: string }) =>
  apiClient.post('/v1/global/post/create', {
    title: data.title,
    content: data.body,
    ...(data.category_id ? { category_id: data.category_id } : {})
  });

export const deleteGlobalPost = (post_id: string) =>
  apiClient.post('/v1/global/post/delete', { post_id: [post_id] });

export const getGroupPosts = ({ group_id, page_number = 1, load_post_number = 50 }: GroupPostPanelPayload) =>
  apiClient.post('/v1/group/post/panel', { group_id, page_number, load_post_number });

export const getGroupPost = (group_id: string, post_id: string) =>
  apiClient.post('/v1/group/post/get', { group_id, post_id });

export const createGroupPost = (data: { group_id: string; title: string; body: string; category_id?: string }) =>
  apiClient.post('/v1/group/post/create', {
    group_id: data.group_id,
    title: data.title,
    content: data.body,
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
}) => {
  const payload: {
    group_id: string;
    post_id: string;
    title?: string;
    content?: string;
    category_id?: string;
    is_global?: boolean;
    author_id?: string;
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

  return apiClient.post('/v1/group/post/modify', payload);
};

export const modifyGlobalPost = (data: {
  post_id: string;
  title?: string;
  body?: string;
  category_id?: string;
  is_global?: boolean;
  author_id?: string;
}) => {
  const payload: {
    post_id: string;
    title?: string;
    content?: string;
    category_id?: string;
    is_global?: boolean;
    author_id?: string;
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

// ─── Post v2: status, tags, pin, trash, review, read state, comments, revisions ───
// Every endpoint exists in both families with the same body; `groupId` selects the
// group family (where `group_id` is mandatory), otherwise the global one is used.

export type PostWriteStatus = 'draft' | 'scheduled' | 'published' | 'archived';
export type PostLinkType = 'task' | 'sprint' | 'minutes' | 'file';
export type PostReactionEmoji = 'like' | 'love' | 'laugh' | 'celebrate' | 'wow' | 'sad';

/** Optional fields accepted by `create` and `modify` on top of title/content/category. */
export interface PostWriteFields {
  status?: PostWriteStatus;
  /** `modify`: full replacement, `[]` clears, omitted = unchanged. */
  tag_ids?: string[];
  /** ISO 8601 with offset — only with `status: 'scheduled'`, where it is required. */
  publish_at?: string;
  /** ISO 8601 with offset. */
  expires_at?: string;
  /** `modify` only. */
  clear_expires_at?: boolean;
  comments_enabled?: boolean;
  /** Group posts only; `modify`: full replacement. */
  links?: { type: PostLinkType; id: string }[];
}

const pickWriteFields = (data: PostWriteFields): PostWriteFields => {
  const out: PostWriteFields = {};
  if (data.status) out.status = data.status;
  if (data.tag_ids) out.tag_ids = data.tag_ids;
  if (data.publish_at) out.publish_at = data.publish_at;
  if (data.expires_at) out.expires_at = data.expires_at;
  if (data.clear_expires_at) out.clear_expires_at = true;
  if (typeof data.comments_enabled === 'boolean') out.comments_enabled = data.comments_enabled;
  if (data.links) out.links = data.links;
  return out;
};

const postScoped = (path: string, groupId: string | undefined, body: Record<string, unknown> = {}) =>
  apiClient.post(`/v1/${groupId ? 'group' : 'global'}/post/${path}`, groupId ? { ...body, group_id: groupId } : body);

export const createPost = (
  groupId: string | undefined,
  data: { title: string; body: string; category_id?: string } & PostWriteFields
) =>
  postScoped('create', groupId, {
    title: data.title,
    content: data.body,
    ...(data.category_id ? { category_id: data.category_id } : {}),
    ...pickWriteFields(data)
  });

export const modifyPost = (
  groupId: string | undefined,
  data: { post_id: string; title?: string; body?: string; category_id?: string } & PostWriteFields
) =>
  postScoped('modify', groupId, {
    post_id: data.post_id,
    ...(typeof data.title === 'string' ? { title: data.title } : {}),
    ...(typeof data.body === 'string' ? { content: data.body } : {}),
    ...(data.category_id ? { category_id: data.category_id } : {}),
    ...pickWriteFields(data)
  });

export const getPost = (groupId: string | undefined, post_id: string) => postScoped('get', groupId, { post_id });

export const getPostPanel = (
  groupId: string | undefined,
  {
    page_number = 1,
    load_post_number = 50,
    status,
    tag_id
  }: { page_number?: number; load_post_number?: number; status?: string; tag_id?: string } = {}
) =>
  postScoped('panel', groupId, {
    page_number,
    load_post_number,
    ...(status ? { status } : {}),
    ...(tag_id ? { tag_id } : {})
  });

export const deletePost = (groupId: string | undefined, post_id: string) =>
  postScoped('delete', groupId, { post_id: [post_id] });

// Pin (max 3 per scope, published posts only)
export const pinPost = (groupId: string | undefined, post_id: string, pinned: boolean) =>
  postScoped('pin', groupId, { post_id, pinned });

// Trash (soft delete — `delete` moves the post here)
export const getPostTrash = (groupId: string | undefined, page_number = 1, load_post_number = 50) =>
  postScoped('trash', groupId, { page_number, load_post_number });
export const restorePosts = (groupId: string | undefined, post_ids: string[]) =>
  postScoped('restore', groupId, { post_id: post_ids });
export const purgePosts = (groupId: string | undefined, post_ids: string[]) =>
  postScoped('purge', groupId, { post_id: post_ids });

// Tags
export const getPostTags = (groupId: string | undefined) => postScoped('tag/get', groupId);
export const createPostTag = (groupId: string | undefined, name: string) => postScoped('tag/create', groupId, { name });
export const deletePostTag = (groupId: string | undefined, tag_id: string) =>
  postScoped('tag/delete', groupId, { tag_id });

// Review workflow
export const submitPostReview = (groupId: string | undefined, post_id: string) =>
  postScoped('review/submit', groupId, { post_id });
export const withdrawPostReview = (groupId: string | undefined, post_id: string) =>
  postScoped('review/withdraw', groupId, { post_id });
export const approvePostReview = (groupId: string | undefined, post_id: string) =>
  postScoped('review/approve', groupId, { post_id });
export const rejectPostReview = (groupId: string | undefined, post_id: string, comment: string) =>
  postScoped('review/reject', groupId, { post_id, comment });
export const getPendingPostReviews = (groupId: string | undefined, page_number = 1, limit = 50) =>
  postScoped('review/pending', groupId, { page_number, limit });
export const getGroupPostReviewSettings = (group_id: string) =>
  apiClient.post('/v1/group/post/review/settings/get', { group_id });
export const setGroupPostReviewSettings = (group_id: string, required: boolean) =>
  apiClient.post('/v1/group/post/review/settings/set', { group_id, required });

// Read state
export const markPostsRead = (groupId: string | undefined, post_ids: string[]) =>
  postScoped('read', groupId, { post_id: post_ids });
export const getPostUnreadCount = (groupId: string | undefined) => postScoped('unread-count', groupId);
export const getPostReaders = (groupId: string | undefined, post_id: string, page_number = 1, limit = 50) =>
  postScoped('readers', groupId, { post_id, page_number, limit });

// Comments & reactions
export const getPostComments = (groupId: string | undefined, post_id: string, page_number = 1, limit = 20) =>
  postScoped('comment/get', groupId, { post_id, page_number, limit });
export const createPostComment = (groupId: string | undefined, post_id: string, content: string, parent_id?: string) =>
  postScoped('comment/create', groupId, { post_id, content, ...(parent_id ? { parent_id } : {}) });
export const modifyPostComment = (groupId: string | undefined, comment_id: string, content: string) =>
  postScoped('comment/modify', groupId, { comment_id, content });
export const deletePostComment = (groupId: string | undefined, comment_id: string) =>
  postScoped('comment/delete', groupId, { comment_id });
export const getPostReactions = (groupId: string | undefined, post_id: string) =>
  postScoped('reaction/get', groupId, { post_id });
export const togglePostReaction = (
  groupId: string | undefined,
  data: { post_id: string; comment_id?: string; emoji: PostReactionEmoji },
  on: boolean
) =>
  postScoped(on ? 'reaction/set' : 'reaction/remove', groupId, {
    post_id: data.post_id,
    emoji: data.emoji,
    ...(data.comment_id ? { comment_id: data.comment_id } : {})
  });

// Revisions (max 20 per post)
export const getPostRevisions = (groupId: string | undefined, post_id: string, page_number = 1, limit = 20) =>
  postScoped('revision/list', groupId, { post_id, page_number, limit });
export const getPostRevision = (groupId: string | undefined, post_id: string, version: number) =>
  postScoped('revision/get', groupId, { post_id, version });
export const restorePostRevision = (groupId: string | undefined, post_id: string, version: number) =>
  postScoped('revision/restore', groupId, { post_id, version });
