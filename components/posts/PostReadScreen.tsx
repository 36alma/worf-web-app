'use client';

import Link from 'next/link';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CalendarClock,
  ChevronDown,
  ClipboardCheck,
  Edit,
  Eye,
  Globe,
  Hash,
  History,
  MoreHorizontal,
  Pin,
  PinOff,
  Tag,
  Timer,
  Trash2,
  Undo2,
  User
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  deletePost,
  getPost,
  getPostReactions,
  markPostsRead,
  pinPost,
  togglePostReaction,
  withdrawPostReview,
  type PostReactionEmoji
} from '@/lib/api/posts';
import {useRouter} from 'next/navigation';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Button from '@/components/ui/Button';
import PostComments from '@/components/posts/PostComments';
import PostLinkChips from '@/components/posts/PostLinkChips';
import PostReadersModal from '@/components/posts/PostReadersModal';
import PostRevisionsModal from '@/components/posts/PostRevisionsModal';
import ReactionBar from '@/components/posts/ReactionBar';
import {EntityModalProvider, useEntityModals} from '@/components/groups/minutes/editor/EntityModalProvider';
import {usePostScope} from '@/hooks/usePostScope';
import {canDeleteGlobalPost, canDeleteGroupPost, canModifyGlobalPost, canModifyGroupPost} from '@/lib/permissions/postGuard';
import {
  httpStatus,
  normalizePost,
  normalizeReactionState,
  readData,
  type PostLink,
  type PostModel,
  type PostReactionState
} from '@/lib/posts/model';

type RawObject = Record<string, unknown>;
type LegacyPostStatus = 'draft' | 'published' | 'scheduled';

interface PostReadScreenProps {
  scope: 'global' | 'group';
  groupId?: string;
  postId: string;
}

export interface ReadPostData {
  id: string;
  title: string;
  body: string;
  author: string;
  authorId?: string;
  categoryName: string;
  status: LegacyPostStatus;
  createdAt: string;
  updatedAt: string;
}

/** Legacy shape used by `PostViewModal` (minutes editor chips). */
export const normalizeReadPost = (payload: unknown): ReadPostData => {
  const post = normalizePost(payload);
  if (!post) {
    return {id: '', title: '', body: '', author: '', authorId: '', categoryName: '', status: 'draft', createdAt: '', updatedAt: ''};
  }
  const status: LegacyPostStatus = post.status === 'published' || post.status === 'scheduled' ? post.status : 'draft';
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    author: post.author,
    authorId: post.authorId,
    categoryName: post.categoryName,
    status,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt
  };
};

export const formatDateTime = (value: string, locale: string, fallback: string): string => {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  const isHungarian = locale.startsWith('hu');
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: !isHungarian
  }).format(date);
};

export default function PostReadScreen(props: PostReadScreenProps) {
  // Linked tasks / minutes / files open in their own modals, which the minutes editor already hosts.
  if (props.scope === 'group' && props.groupId) {
    return (
      <EntityModalProvider groupId={props.groupId}>
        <PostReadContent {...props} />
      </EntityModalProvider>
    );
  }
  return <PostReadContent {...props} />;
}

function GroupLinkChips({links, groupId}: {links: PostLink[]; groupId: string}) {
  const modals = useEntityModals();
  const router = useRouter();
  const locale = useLocale();
  return (
    <PostLinkChips
      links={links}
      onOpen={(link) => {
        if (link.type === 'sprint') {
          router.push(`/${locale}/groups/${encodeURIComponent(groupId)}/tasks`);
          return;
        }
        modals.view({type: link.type, id: link.id, label: link.label});
      }}
    />
  );
}

function PostReadContent({scope, groupId = '', postId}: PostReadScreenProps) {
  const locale = useLocale();
  const postsT = useTranslations('posts');
  const detailT = useTranslations('posts.detail');
  const actionsT = useTranslations('posts.actions');
  const reviewT = useTranslations('posts.review');
  const publishT = useTranslations('posts.publish');

  const scopeGroupId = scope === 'group' ? groupId : '';
  const apiGroup = scopeGroupId || undefined;
  const postScope = usePostScope(scopeGroupId);

  const resolvedPostId = useMemo(() => {
    const trimmed = postId.trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null') {
      return '';
    }

    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  }, [postId]);

  const backHref = scope === 'group' ? `/${locale}/groups/${encodeURIComponent(groupId)}/posts` : `/${locale}/posts`;
  const editHref =
    scope === 'group' ? `/${locale}/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(resolvedPostId)}/edit` : `/${locale}/posts/${encodeURIComponent(resolvedPostId)}/edit`;

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<PostModel | null>(null);
  const [reactions, setReactions] = useState<PostReactionState | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [readersOpen, setReadersOpen] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const currentUserId = postScope.currentUserId;
  const isGroup = postScope.isGroup;

  const canEdit = useMemo(() => {
    if (!post || post.status === 'pending_review') return false;
    return isGroup
      ? canModifyGroupPost(currentUserId, post.authorId, postScope.permissions)
      : canModifyGlobalPost(currentUserId, post.authorId, postScope.permissions);
  }, [currentUserId, isGroup, post, postScope.permissions]);

  const canDelete = useMemo(() => {
    if (!post) return false;
    return isGroup
      ? canDeleteGroupPost(currentUserId, post.authorId, postScope.permissions)
      : canDeleteGlobalPost(currentUserId, post.authorId, postScope.permissions);
  }, [currentUserId, isGroup, post, postScope.permissions]);

  const isPublished = post?.status === 'published';
  const canPin = Boolean(post && isPublished && postScope.can('pin'));
  const authorTools = Boolean(post && postScope.canSeeAuthorTools(post));
  const isAuthor = Boolean(post && postScope.isAuthor(post));
  const canComment = postScope.can('comment');

  const loadPost = useCallback(async () => {
    const response = await getPost(apiGroup, resolvedPostId);
    return normalizePost(response.data);
  }, [apiGroup, resolvedPostId]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const normalized = await loadPost();
        if (!mounted) return;
        setPost(normalized);

        if (normalized?.status === 'published') {
          // `get` does not mark as read — the client reports the actual open.
          if (!normalized.isRead) {
            markPostsRead(apiGroup, [normalized.id]).catch(() => undefined);
          }
          getPostReactions(apiGroup, normalized.id)
            .then((reactionResponse) => mounted && setReactions(normalizeReactionState(reactionResponse.data)))
            .catch(() => undefined);
        }
      } catch {
        if (mounted) {
          setPost(null);
        }
        toast.error(detailT('loadError'));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    if (resolvedPostId) {
      void load();
    } else {
      setLoading(false);
      setPost(null);
    }

    return () => {
      mounted = false;
    };
  }, [apiGroup, detailT, loadPost, resolvedPostId]);

  const reload = async () => {
    try {
      setPost(await loadPost());
    } catch {
      toast.error(detailT('loadError'));
    }
  };

  const handleDelete = async () => {
    if (!post || !canDelete) return;

    try {
      setBusy(true);
      await deletePost(apiGroup, post.id);
      toast.success(postsT('toasts.postTrashed'));
      router.push(backHref);
    } catch {
      toast.error(postsT('toasts.postDeleteError'));
      setBusy(false);
      setDeleteConfirmOpen(false);
    }
  };

  const handlePin = async () => {
    if (!post) return;
    const next = !post.isPinned;
    try {
      setBusy(true);
      const response = await pinPost(apiGroup, post.id, next);
      const root = readData(response.data) as RawObject | null;
      setPost({...post, isPinned: typeof root?.is_pinned === 'boolean' ? root.is_pinned : next});
      toast.success(next ? postsT('toasts.pinned') : postsT('toasts.unpinned'));
    } catch (error) {
      const status = httpStatus(error);
      toast.error(status === 400 || status === 422 ? postsT('toasts.pinLimit') : postsT('toasts.pinError'));
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async () => {
    if (!post) return;
    try {
      setBusy(true);
      await withdrawPostReview(apiGroup, post.id);
      toast.success(reviewT('withdrawn'));
      await reload();
    } catch {
      toast.error(reviewT('withdrawError'));
    } finally {
      setBusy(false);
    }
  };

  const toggleReaction = async (emoji: PostReactionEmoji, on: boolean) => {
    if (!post || !reactions) return;
    const apply = (state: boolean) =>
      setReactions((current) =>
        current
          ? {
              ...current,
              mine: state ? [...current.mine, emoji] : current.mine.filter((item) => item !== emoji),
              counts: {...current.counts, [emoji]: Math.max(0, (current.counts[emoji] ?? 0) + (state ? 1 : -1))}
            }
          : current
      );
    apply(on);
    try {
      await togglePostReaction(apiGroup, {post_id: post.id, emoji}, on);
    } catch {
      apply(!on);
      toast.error(postsT('reactions.error'));
    }
  };

  const title = post?.title.trim() ? post.title : postsT('untitled');
  const titleForBreadcrumb = title.length > 30 ? `${title.slice(0, 30).trimEnd()}...` : title;
  const author = post?.author.trim() ? post.author : postsT('unknownAuthor');
  const createdAt = formatDateTime(post?.createdAt ?? '', locale, postsT('timeUnknown'));
  const updatedAt = formatDateTime(post?.updatedAt ?? '', locale, postsT('timeUnknown'));
  const hasMenu = canEdit || canDelete || canPin || authorTools;

  return (
    <section className="post-read-page space-y-4">
      <nav className="topbar-breadcrumb" aria-label="Breadcrumb">
        <Link href={`/${locale}/dashboard`} className="hover:text-[var(--text-primary)]">
          Dashboard
        </Link>
        <ChevronDown size={14} className="breadcrumb-sep rotate-[-90deg]" />
        <Link href={backHref} className="hover:text-[var(--text-primary)]">
          {postsT('title')}
        </Link>
        <ChevronDown size={14} className="breadcrumb-sep rotate-[-90deg]" />
        <span className="breadcrumb-current">{loading ? detailT('loading') : titleForBreadcrumb}</span>
      </nav>

      <header className="page-header post-read-header flex flex-wrap items-start justify-between gap-3">
        <div className="page-title-section min-w-0">
          <div className="page-title-row flex items-center gap-2">
            <h1 className="page-title text-[20px] font-semibold leading-[1.3] text-[var(--text-primary)]">{detailT('title')}</h1>
            <span className="scope-badge inline-flex items-center gap-1 rounded-[6px] bg-[rgba(136,136,136,0.10)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.03em] text-[var(--text-secondary)]">
              <Globe size={12} strokeWidth={1.75} />
              {scope === 'group' ? detailT('group') : detailT('global')}
            </span>
          </div>
          <p className="page-subtitle mt-1 text-[13px] text-[var(--text-tertiary)]">{detailT('subtitle')}</p>
        </div>

        <div className="post-read-actions flex items-center gap-2">
          <Link href={backHref} className="btn-secondary">
            <ArrowLeft size={14} />
            <span>{actionsT('back')}</span>
          </Link>
          {hasMenu && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="post-menu-btn" aria-label={actionsT('menu')}>
                  <MoreHorizontal size={16} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="posts-dropdown-content" sideOffset={4} align="end">
                  {canEdit && (
                    <DropdownMenu.Item className="posts-dropdown-item" asChild>
                      <Link href={editHref}>
                        <Edit size={14} />
                        <span>{actionsT('edit')}</span>
                      </Link>
                    </DropdownMenu.Item>
                  )}
                  {canPin && post && (
                    <DropdownMenu.Item className="posts-dropdown-item" disabled={busy} onClick={() => void handlePin()}>
                      {post.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                      <span>{post.isPinned ? actionsT('unpin') : actionsT('pin')}</span>
                    </DropdownMenu.Item>
                  )}
                  {authorTools && isPublished && (
                    <DropdownMenu.Item className="posts-dropdown-item" onClick={() => setReadersOpen(true)}>
                      <Eye size={14} />
                      <span>{actionsT('readers')}</span>
                    </DropdownMenu.Item>
                  )}
                  {authorTools && (
                    <DropdownMenu.Item className="posts-dropdown-item" onClick={() => setRevisionsOpen(true)}>
                      <History size={14} />
                      <span>{actionsT('revisions')}</span>
                    </DropdownMenu.Item>
                  )}
                  {canDelete && (canEdit || canPin || authorTools) && <DropdownMenu.Separator className="posts-dropdown-separator" />}
                  {canDelete && (
                    <DropdownMenu.Item className="posts-dropdown-item danger" onClick={() => setDeleteConfirmOpen(true)}>
                      <Trash2 size={14} />
                      <span>{actionsT('delete')}</span>
                    </DropdownMenu.Item>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
        </div>
      </header>

      {loading ? (
        <article className="post-read-article surface rounded-xl p-4 md:p-6">
          <div className="post-skeleton post-skeleton-title" />
          <div className="post-skeleton post-skeleton-meta" />
          <div className="post-skeleton post-skeleton-line" />
          <div className="post-skeleton post-skeleton-line short" />
          <div className="post-skeleton post-skeleton-line" />
        </article>
      ) : !post ? (
        <div className="surface rounded-xl p-4 text-sm text-[var(--text-secondary)]">{detailT('notFound')}</div>
      ) : (
        <>
          {post.status === 'pending_review' && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 text-sm text-[var(--text-secondary)]">
              <span className="flex items-center gap-2">
                <ClipboardCheck size={16} className="shrink-0" />
                {reviewT('pendingBanner')}
              </span>
              {isAuthor && (
                <Button size="sm" startIcon={<Undo2 size={14} />} disabled={busy} onClick={() => void handleWithdraw()}>
                  {reviewT('withdraw')}
                </Button>
              )}
            </div>
          )}

          {post.status === 'draft' && post.review?.decision === 'rejected' && (
            <div className="flex items-start gap-2 rounded-lg border border-[var(--warning)] bg-[var(--bg-surface)] p-3 text-sm text-[var(--text-secondary)]">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--warning)]" />
              <div>
                <p className="font-medium text-[var(--text-primary)]">
                  {reviewT('rejectedBanner')}
                  {post.review.decidedAt && (
                    <span className="ml-2 text-xs font-normal text-[var(--text-tertiary)]">{formatDateTime(post.review.decidedAt, locale, '')}</span>
                  )}
                </p>
                {post.review.comment && <p className="mt-1 whitespace-pre-wrap">{post.review.comment}</p>}
              </div>
            </div>
          )}

          <article className="post-read-article surface rounded-xl p-4 md:p-6">
            <h2 className="post-read-title flex items-center gap-2">
              {post.isPinned && <Pin size={16} className="shrink-0 text-[var(--accent)]" aria-label={postsT('pinned')} />}
              {title}
            </h2>

            <div className="post-read-meta">
              <span className="post-read-badge">
                <User size={12} />
                {author}
              </span>
              <span className={`post-read-badge post-status-badge status-${post.status}`}>{postsT(`status.${post.status}`)}</span>
              {post.categoryName && (
                <span className="post-read-badge">
                  <Tag size={12} />
                  {post.categoryName}
                </span>
              )}
              {post.tags.map((tag) => (
                <span key={tag.id} className="post-read-badge">
                  <Hash size={12} />
                  {tag.name}
                </span>
              ))}
              <span className="post-read-badge">
                <Calendar size={12} />
                {detailT('created')}: {createdAt}
              </span>
              {post.updatedAt && (
                <span className="post-read-badge">
                  <Calendar size={12} />
                  {detailT('updated')}: {updatedAt}
                </span>
              )}
              {post.status === 'scheduled' && post.publishAt && (
                <span className="post-read-badge">
                  <CalendarClock size={12} />
                  {publishT('publishAt')}: {formatDateTime(post.publishAt, locale, '')}
                </span>
              )}
              {post.expiresAt && (
                <span className="post-read-badge">
                  <Timer size={12} />
                  {publishT('expiresAt')}: {formatDateTime(post.expiresAt, locale, '')}
                </span>
              )}
            </div>

            {post.links.length > 0 && (
              <div className="mt-3">
                {scope === 'group' && groupId ? <GroupLinkChips links={post.links} groupId={groupId} /> : <PostLinkChips links={post.links} />}
              </div>
            )}

            <div className="post-read-content mt-4">
              {post.body.trim() ? (
                <div className="post-detail-content prose prose-invert max-w-none" dangerouslySetInnerHTML={{__html: post.body}} />
              ) : (
                <p className="text-sm text-[var(--text-tertiary)]">-</p>
              )}
            </div>

            {isPublished && reactions && (
              <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
                <ReactionBar
                  counts={reactions.counts}
                  mine={reactions.mine}
                  available={reactions.available}
                  canReact={canComment}
                  onToggle={(emoji, on) => void toggleReaction(emoji, on)}
                />
              </div>
            )}

            {isPublished && <p className="mt-3 text-xs text-[var(--text-tertiary)]">{detailT('readPrivacyNote')}</p>}
          </article>

          {isPublished &&
            (post.commentsEnabled ? (
              <PostComments
                groupId={apiGroup}
                postId={post.id}
                canComment={canComment}
                canDeleteOther={postScope.can('commentDeleteOther')}
              />
            ) : (
              <p className="text-sm text-[var(--text-tertiary)]">{postsT('comments.disabled')}</p>
            ))}

          <PostReadersModal open={readersOpen} groupId={apiGroup} postId={post.id} onClose={() => setReadersOpen(false)} />
          <PostRevisionsModal
            open={revisionsOpen}
            groupId={apiGroup}
            postId={post.id}
            current={{title: post.title, body: post.body}}
            canRestore={canEdit}
            onClose={() => setRevisionsOpen(false)}
            onRestored={() => void reload()}
          />
        </>
      )}

      <ConfirmDialog
        open={deleteConfirmOpen}
        title={postsT('deletePostTitle')}
        message={postsT('deletePostMessage')}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </section>
  );
}
