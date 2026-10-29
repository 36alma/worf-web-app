'use client';

import {useCallback, useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {CornerDownRight, MessageSquare, Pencil, Trash2} from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {Textarea} from '@/components/ui/Textarea';
import ReactionBar from '@/components/posts/ReactionBar';
import {
  createPostComment,
  deletePostComment,
  getPostComments,
  modifyPostComment,
  togglePostReaction,
  type PostReactionEmoji
} from '@/lib/api/posts';
import {findArray, httpStatus, normalizeComment, numberField, type PostComment} from '@/lib/posts/model';
import {formatDateTime} from '@/components/posts/PostReadScreen';

const PAGE_SIZE = 20;
const MAX_LENGTH = 2000;

interface PostCommentsProps {
  groupId?: string;
  postId: string;
  canComment: boolean;
  canDeleteOther: boolean;
}

type Draft = {mode: 'reply'; parentId: string} | {mode: 'edit'; commentId: string};

const patchComment = (list: PostComment[], id: string, patch: (comment: PostComment) => PostComment): PostComment[] =>
  list.map((comment) =>
    comment.id === id ? patch(comment) : {...comment, replies: patchComment(comment.replies, id, patch)}
  );

export default function PostComments({groupId, postId, canComment, canDeleteOther}: PostCommentsProps) {
  const t = useTranslations('posts.comments');
  const postsT = useTranslations('posts');
  const locale = useLocale();

  const [comments, setComments] = useState<PostComment[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftText, setDraftText] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const load = useCallback(
    async (pageCount: number) => {
      try {
        const results = await Promise.all(
          Array.from({length: pageCount}, (_, index) => getPostComments(groupId, postId, index + 1, PAGE_SIZE))
        );
        const merged = results.flatMap((response) =>
          findArray(response.data, ['comments'])
            .map(normalizeComment)
            .filter((comment): comment is PostComment => Boolean(comment))
        );
        const lastPage = findArray(results[results.length - 1]?.data, ['comments']);
        setComments(merged);
        setHasMore(lastPage.length === PAGE_SIZE);
        setTotal(numberField(results[results.length - 1]?.data, ['total_comments'], merged.length));
        setPages(pageCount);
      } catch {
        toast.error(t('loadError'));
      } finally {
        setLoading(false);
      }
    },
    [groupId, postId, t]
  );

  useEffect(() => {
    setLoading(true);
    void load(1);
  }, [load]);

  const reportError = (error: unknown, fallback: string) => {
    toast.error(httpStatus(error) === 403 ? t('forbidden') : fallback);
  };

  const submitNew = async () => {
    const content = newText.trim();
    if (!content) return;
    setBusy(true);
    try {
      await createPostComment(groupId, postId, content);
      setNewText('');
      await load(pages);
    } catch (error) {
      reportError(error, t('saveError'));
    } finally {
      setBusy(false);
    }
  };

  const submitDraft = async () => {
    const content = draftText.trim();
    if (!draft || !content) return;
    setBusy(true);
    try {
      if (draft.mode === 'reply') {
        await createPostComment(groupId, postId, content, draft.parentId);
      } else {
        await modifyPostComment(groupId, draft.commentId, content);
      }
      setDraft(null);
      setDraftText('');
      await load(pages);
    } catch (error) {
      reportError(error, t('saveError'));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    const id = deletingId;
    setDeletingId('');
    try {
      await deletePostComment(groupId, id);
      await load(pages);
    } catch (error) {
      reportError(error, t('deleteError'));
    }
  };

  const toggleReaction = async (comment: PostComment, emoji: PostReactionEmoji, on: boolean) => {
    const apply = (state: boolean) =>
      setComments((list) =>
        patchComment(list, comment.id, (current) => ({
          ...current,
          myReactions: state ? [...current.myReactions, emoji] : current.myReactions.filter((e) => e !== emoji),
          reactions: {...current.reactions, [emoji]: Math.max(0, (current.reactions[emoji] ?? 0) + (state ? 1 : -1))}
        }))
      );
    apply(on);
    try {
      await togglePostReaction(groupId, {post_id: postId, comment_id: comment.id, emoji}, on);
    } catch (error) {
      apply(!on);
      reportError(error, t('reactionError'));
    }
  };

  const renderEditor = (onCancel: () => void) => (
    <div className="mt-2 space-y-2">
      <Textarea
        value={draftText}
        maxLength={MAX_LENGTH}
        rows={3}
        autoFocus
        onChange={(event) => setDraftText(event.target.value)}
        placeholder={draft?.mode === 'reply' ? t('replyPlaceholder') : t('placeholder')}
      />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          {t('cancel')}
        </Button>
        <Button size="sm" variant="primary" onClick={() => void submitDraft()} disabled={busy || !draftText.trim()}>
          {draft?.mode === 'edit' ? t('save') : t('reply')}
        </Button>
      </div>
    </div>
  );

  const renderComment = (comment: PostComment, isReply: boolean) => {
    const editing = draft?.mode === 'edit' && draft.commentId === comment.id;
    const replying = draft?.mode === 'reply' && draft.parentId === comment.id;
    const canDelete = !comment.deleted && (comment.isMine || canDeleteOther);
    const authorName = comment.author ? comment.author.name || postsT('unknownAuthor') : t('deletedUser');

    // A deleted top-level comment only stays visible as a placeholder for its replies.
    if (comment.deleted && comment.replies.length === 0) return null;

    return (
      <li key={comment.id} className={isReply ? 'mt-3 border-l border-[var(--border-subtle)] pl-3' : 'py-3'}>
        {comment.deleted ? (
          <p className="text-[13px] italic text-[var(--text-tertiary)]">{t('deletedComment')}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-[var(--text-tertiary)]">
              <span className="text-[13px] font-medium text-[var(--text-primary)]">{authorName}</span>
              <time>{formatDateTime(comment.createdAt, locale, '')}</time>
              {comment.editedAt && <span>· {t('edited')}</span>}
            </div>
            {editing ? (
              renderEditor(() => setDraft(null))
            ) : (
              <p className="mt-1 whitespace-pre-wrap break-words text-[14px] text-[var(--text-secondary)]">{comment.content}</p>
            )}
            {!editing && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <ReactionBar
                  counts={comment.reactions}
                  mine={comment.myReactions}
                  canReact={canComment}
                  onToggle={(emoji, on) => void toggleReaction(comment, emoji, on)}
                />
                {canComment && !isReply && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    onClick={() => {
                      setDraft({mode: 'reply', parentId: comment.id});
                      setDraftText('');
                    }}
                  >
                    <CornerDownRight size={12} /> {t('reply')}
                  </button>
                )}
                {comment.isMine && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    onClick={() => {
                      setDraft({mode: 'edit', commentId: comment.id});
                      setDraftText(comment.content);
                    }}
                  >
                    <Pencil size={12} /> {t('edit')}
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--danger)]"
                    onClick={() => setDeletingId(comment.id)}
                  >
                    <Trash2 size={12} /> {t('delete')}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {(comment.replies.length > 0 || replying) && (
          <ul>
            {comment.replies.map((reply) => renderComment(reply, true))}
            {replying && <li className="mt-3 border-l border-[var(--border-subtle)] pl-3">{renderEditor(() => setDraft(null))}</li>}
          </ul>
        )}
      </li>
    );
  };

  return (
    <section className="surface rounded-xl p-4 md:p-6">
      <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-[var(--text-primary)]">
        <MessageSquare size={16} strokeWidth={1.75} />
        {t('title', {count: total})}
      </h3>

      {canComment && (
        <div className="mb-2 space-y-2">
          <Textarea
            value={newText}
            maxLength={MAX_LENGTH}
            rows={3}
            onChange={(event) => setNewText(event.target.value)}
            placeholder={t('placeholder')}
          />
          <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
            <span>
              {newText.length}/{MAX_LENGTH}
            </span>
            <Button size="sm" variant="primary" onClick={() => void submitNew()} disabled={busy || !newText.trim()}>
              {t('submit')}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--text-tertiary)]">{t('loading')}</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)]">{t('empty')}</p>
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)]">{comments.map((comment) => renderComment(comment, false))}</ul>
      )}

      {!loading && hasMore && (
        <div className="mt-3 flex justify-center">
          <Button size="sm" variant="ghost" onClick={() => void load(pages + 1)}>
            {t('loadMore')}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deletingId)}
        title={t('deleteTitle')}
        message={t('deleteMessage')}
        onCancel={() => setDeletingId('')}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}
