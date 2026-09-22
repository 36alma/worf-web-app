'use client';

import {useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import {useLocale, useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {ExternalLink} from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import Skeleton from '@/components/ui/Skeleton';
import MarkdownRenderer from '@/components/posts/MarkdownRenderer';
import {formatDateTime, normalizeReadPost, type ReadPostData} from '@/components/posts/PostReadScreen';
import {useGroupPermission} from '@/components/providers/GroupPermissionContext';
import {deleteGroupPost, getGroupPost} from '@/lib/api/posts';
import {canDeleteGroupPost, canModifyGroupPost} from '@/lib/permissions/postGuard';
import {useAuthStore} from '@/lib/store/authStore';

export interface PostViewModalProps {
  open: boolean;
  groupId: string;
  postId: string;
  onClose: () => void;
  /** Shown as an "Edit" button when the user may modify this post. */
  onEdit?: () => void;
  onDeleted?: () => void;
  /** The post could not be loaded (404/403/…) — the caller decides what to tell the user. */
  onLoadError?: (error: unknown) => void;
}

/** Read-only post in a modal — same data, renderer and modify/delete guards as the full-page PostReadScreen. */
export default function PostViewModal({open, groupId, postId, onClose, onEdit, onDeleted, onLoadError}: PostViewModalProps) {
  const locale = useLocale();
  const postsT = useTranslations('posts');
  const detailT = useTranslations('posts.detail');
  const actionsT = useTranslations('posts.actions');

  const [post, setPost] = useState<ReadPostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const {permissions} = useGroupPermission();
  const user = useAuthStore((state) => state.user);
  const currentUserId = user?.id || (user as {user_id?: string} | null)?.user_id;

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    getGroupPost(groupId, postId)
      .then((response) => mounted && setPost(normalizeReadPost(response.data)))
      .catch((error) => {
        if (!mounted) return;
        setPost(null);
        if (onLoadError) onLoadError(error);
        else toast.error(detailT('loadError'));
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, groupId, postId]);

  const canEdit = useMemo(
    () => Boolean(post && onEdit && canModifyGroupPost(currentUserId, post.authorId || '', permissions)),
    [post, onEdit, currentUserId, permissions]
  );
  const canDelete = useMemo(
    () => Boolean(post && canDeleteGroupPost(currentUserId, post.authorId || '', permissions)),
    [post, currentUserId, permissions]
  );

  const handleDelete = async () => {
    if (!post || !canDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteGroupPost(groupId, post.id || postId);
      toast.success(postsT('toasts.postDeleted'));
      setConfirmOpen(false);
      onDeleted?.();
    } catch {
      toast.error(postsT('toasts.postDeleteError'));
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const title = post?.title.trim() ? post.title : postsT('untitled');
  const author = post?.author.trim() ? post.author : postsT('unknownAuthor');
  const createdAt = formatDateTime(post?.createdAt ?? '', locale, postsT('timeUnknown'));
  const pageHref = `/${locale}/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}`;

  return (
    <>
      <Modal open={open} title={loading ? detailT('title') : title} onClose={onClose}>
        {loading || !post ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-[var(--text-tertiary)]">
              {[author, post.categoryName, createdAt].filter(Boolean).join(' · ')}
            </p>
            <MarkdownRenderer content={post.body} />
            <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-default)] pt-4">
              <Link
                href={pageHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-[var(--btn-height-md)] items-center gap-1.5 rounded-[var(--btn-radius)] border border-[var(--border-default)] px-[var(--btn-padding)] text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              >
                <ExternalLink size={14} strokeWidth={1.75} />
                {actionsT('view')}
              </Link>
              {canEdit && (
                <Button type="button" variant="secondary" onClick={onEdit}>
                  {actionsT('edit')}
                </Button>
              )}
              {canDelete && (
                <Button type="button" variant="danger" onClick={() => setConfirmOpen(true)} disabled={deleting}>
                  {actionsT('delete')}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title={postsT('deletePostTitle')}
        message={postsT('deletePostMessage')}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
