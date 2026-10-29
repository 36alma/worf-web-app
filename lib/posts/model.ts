import type {PostLinkType, PostReactionEmoji} from '@/lib/api/posts';

type RawObject = Record<string, unknown>;

export type PostStatus = 'draft' | 'pending_review' | 'scheduled' | 'published' | 'archived';

export const POST_STATUSES: PostStatus[] = ['published', 'draft', 'pending_review', 'scheduled', 'archived'];

export interface PostTag {
  id: string;
  name: string;
}

export interface PostLink {
  type: PostLinkType;
  id: string;
  label: string;
}

export interface PostReview {
  decision: string;
  comment: string;
  decidedAt: string;
}

export interface PostModel {
  id: string;
  /** Stable key — `id` is re-encrypted on every response. */
  uuid: string;
  title: string;
  body: string;
  status: PostStatus;
  publishAt: string;
  expiresAt: string;
  commentsEnabled: boolean;
  isRead: boolean;
  isPinned: boolean;
  /** Only the author receives the `review` field (possibly `null`). */
  review: PostReview | null;
  isAuthorView: boolean;
  links: PostLink[];
  tags: PostTag[];
  isGlobal: boolean;
  groupId: string;
  author: string;
  authorId: string;
  categoryId: string;
  categoryName: string;
  createdAt: string;
  updatedAt: string;
}

export const REACTION_EMOJI: Record<PostReactionEmoji, string> = {
  like: '👍',
  love: '❤️',
  laugh: '😂',
  celebrate: '🎉',
  wow: '😮',
  sad: '😢'
};

export const REACTION_KEYS = Object.keys(REACTION_EMOJI) as PostReactionEmoji[];

export const MAX_TAGS_PER_POST = 10;
export const MAX_LINKS_PER_POST = 10;
export const MAX_PINNED_PER_SCOPE = 3;

// ─── Permissions ────────────────────────────────────────────────────

const POST_PERMISSIONS = {
  create: ['post.create.global', 'group.post.create'],
  modifyOther: ['post.modify.other.global', 'group.post.modify.other'],
  delete: ['post.delete.global', 'group.post.delete'],
  pin: ['post.pin.global', 'group.post.pin'],
  restore: ['post.restore.global', 'group.post.restore'],
  purge: ['post.purge.global', 'group.post.purge'],
  tagManage: ['post.tag.manage.global', 'group.post.tag.manage'],
  comment: ['post.comment.create.global', 'group.post.comment.create'],
  commentDeleteOther: ['post.comment.delete.other.global', 'group.post.comment.delete.other'],
  review: ['post.review.global', 'group.post.review'],
  reviewManage: ['', 'group.post.review.manage']
} as const;

export type PostPermissionKey = keyof typeof POST_PERMISSIONS;

export const hasPostPermission = (
  permissions: Record<string, boolean> | null | undefined,
  key: PostPermissionKey,
  isGroup: boolean
): boolean => {
  const name = POST_PERMISSIONS[key][isGroup ? 1 : 0];
  return Boolean(name) && permissions?.[name] === true;
};

// ─── Normalisation ──────────────────────────────────────────────────

export const readData = (payload: unknown): unknown => {
  if (payload && typeof payload === 'object' && 'data' in (payload as RawObject)) {
    return (payload as RawObject).data;
  }
  return payload;
};

const obj = (value: unknown): RawObject | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RawObject) : null;

const str = (value: unknown): string => (value == null ? '' : String(value));

export const findArray = (source: unknown, keys: string[]): unknown[] => {
  const data = readData(source);
  if (Array.isArray(data)) return data;
  const record = obj(data);
  if (!record) return [];
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
};

const toStatus = (value: unknown): PostStatus => {
  const normalized = str(value).toLowerCase();
  return (POST_STATUSES as string[]).includes(normalized) ? (normalized as PostStatus) : 'published';
};

const normalizeTags = (value: unknown): PostTag[] =>
  (Array.isArray(value) ? value : [])
    .map((item) => {
      const row = obj(item);
      if (!row) return null;
      const id = str(row.tag_id ?? row.id);
      return id ? {id, name: str(row.name ?? id)} : null;
    })
    .filter((tag): tag is PostTag => Boolean(tag));

const LINK_TYPES: PostLinkType[] = ['task', 'sprint', 'minutes', 'file'];

const normalizeLinks = (value: unknown): PostLink[] =>
  (Array.isArray(value) ? value : [])
    .map((item) => {
      const row = obj(item);
      if (!row) return null;
      const type = str(row.type) as PostLinkType;
      const id = str(row.id);
      if (!id || !LINK_TYPES.includes(type)) return null;
      return {type, id, label: str(row.label) || id};
    })
    .filter((link): link is PostLink => Boolean(link));

/** Accepts a `get` response (`{post: {...}}`) or one `panel` row (flat or `{post, author, category}`). */
export const normalizePost = (input: unknown): PostModel | null => {
  const root = obj(readData(input));
  if (!root) return null;
  const post = obj(root.post) ?? root;
  const author = obj(post.author) ?? obj(root.author);
  const category = obj(post.category) ?? obj(root.category);
  const review = obj(post.review);

  const id = str(post.post_id ?? post.id ?? root.post_id ?? root.id);
  if (!id) return null;

  return {
    id,
    uuid: str(post.post_uuid ?? root.post_uuid) || id,
    title: str(post.title ?? root.title),
    body: str(post.content ?? post.body ?? root.content ?? root.body),
    status: toStatus(post.status ?? root.status),
    publishAt: str(post.publish_at),
    expiresAt: str(post.expires_at),
    commentsEnabled: post.comments_enabled !== false,
    isRead: post.is_read !== false,
    isPinned: post.is_pinned === true,
    review: review
      ? {decision: str(review.decision).toLowerCase(), comment: str(review.comment), decidedAt: str(review.decided_at)}
      : null,
    isAuthorView: 'review' in post,
    links: normalizeLinks(post.links),
    tags: normalizeTags(post.tags),
    isGlobal: post.is_global === true,
    groupId: str(post.group_id),
    author: str(author?.name ?? author?.username ?? post.author_name ?? root.author_name ?? (typeof post.author === 'string' ? post.author : '')),
    authorId: str(author?.id ?? author?.user_id ?? post.author_id ?? root.author_id),
    categoryId: str(category?.category_id ?? category?.post_category_id ?? category?.id ?? post.category_id ?? post.post_category_id),
    categoryName: str(category?.category_name ?? category?.name ?? post.category_name ?? root.category_name),
    createdAt: str(post.created_at ?? root.created_at),
    updatedAt: str(post.updated_at ?? root.updated_at)
  };
};

export const normalizePostList = (payload: unknown): PostModel[] =>
  findArray(payload, ['posts', 'items', 'rows'])
    .map(normalizePost)
    .filter((post): post is PostModel => Boolean(post));

export const normalizeTagList = (payload: unknown): PostTag[] => normalizeTags(findArray(payload, ['tags']));

// ─── Comments & reactions ───────────────────────────────────────────

export type ReactionCounts = Partial<Record<PostReactionEmoji, number>>;

export interface PostReactionState {
  counts: ReactionCounts;
  mine: PostReactionEmoji[];
  available: PostReactionEmoji[];
}

/** Reaction totals may arrive as `{like: 2}` or `[{emoji: 'like', count: 2}]`. */
export const normalizeReactionCounts = (value: unknown): ReactionCounts => {
  const counts: ReactionCounts = {};
  if (Array.isArray(value)) {
    for (const item of value) {
      const row = obj(item);
      const emoji = str(row?.emoji) as PostReactionEmoji;
      if (emoji in REACTION_EMOJI) counts[emoji] = Number(row?.count ?? 0);
    }
    return counts;
  }
  const record = obj(value);
  if (record) {
    for (const [emoji, count] of Object.entries(record)) {
      if (emoji in REACTION_EMOJI) counts[emoji as PostReactionEmoji] = Number(count) || 0;
    }
  }
  return counts;
};

const normalizeEmojiList = (value: unknown): PostReactionEmoji[] =>
  (Array.isArray(value) ? value : []).map(str).filter((emoji): emoji is PostReactionEmoji => emoji in REACTION_EMOJI);

export const normalizeReactionState = (payload: unknown): PostReactionState => {
  const root = obj(readData(payload)) ?? {};
  const available = normalizeEmojiList(root.available);
  return {
    counts: normalizeReactionCounts(root.reactions),
    mine: normalizeEmojiList(root.my_reactions),
    available: available.length ? available : REACTION_KEYS
  };
};

export interface PostComment {
  id: string;
  author: {id: string; name: string} | null;
  isMine: boolean;
  content: string;
  deleted: boolean;
  createdAt: string;
  editedAt: string;
  reactions: ReactionCounts;
  myReactions: PostReactionEmoji[];
  replies: PostComment[];
}

export const normalizeComment = (input: unknown): PostComment | null => {
  const row = obj(input);
  if (!row) return null;
  const id = str(row.comment_id ?? row.id);
  if (!id) return null;
  const author = obj(row.author);
  return {
    id,
    author: author ? {id: str(author.id ?? author.user_id), name: str(author.name ?? author.full_name)} : null,
    isMine: row.is_mine === true,
    content: str(row.content),
    deleted: row.deleted === true,
    createdAt: str(row.created_at),
    editedAt: str(row.edited_at),
    reactions: normalizeReactionCounts(row.reactions),
    myReactions: normalizeEmojiList(row.my_reactions),
    replies: (Array.isArray(row.replies) ? row.replies : [])
      .map(normalizeComment)
      .filter((reply): reply is PostComment => Boolean(reply))
  };
};

// ─── Misc helpers ───────────────────────────────────────────────────

export const httpStatus = (error: unknown): number | undefined =>
  (error as {response?: {status?: number}} | undefined)?.response?.status;

export const numberField = (payload: unknown, keys: string[], fallback = 0): number => {
  const root = obj(readData(payload));
  if (!root) return fallback;
  for (const key of keys) {
    const value = Number(root[key]);
    if (Number.isFinite(value) && root[key] != null) return value;
  }
  return fallback;
};

/** Plain text of a post body (HTML or Markdown) — for excerpts and revision diffs. */
export const bodyToText = (body: string): string =>
  body
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|pre|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
