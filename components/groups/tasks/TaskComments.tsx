import {useEffect, useState, useCallback} from 'react';
import {getTaskComments, createTaskComment, deleteTaskComment} from '@/lib/api/tasks';
import {TaskComment} from './types';
import {Trash2, Send, MessageCircle, HelpCircle} from 'lucide-react';
import toast from 'react-hot-toast';
import {TooltipProvider, Tooltip, TooltipTrigger, TooltipContent} from '@/components/ui/tooltip';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {usePermissions} from '@/hooks/usePermissions';

export interface TaskCommentsProps {
  groupId: string;
  taskId: string;
  permissions: {
    read: boolean;
    create: boolean;
    modify: boolean;
    delete: boolean;
  };
}

/* ── Dátum formázó segédfüggvény ── */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('hu-HU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/* ── Iniciálé generátor ── */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

export default function TaskComments({groupId, taskId, permissions}: TaskCommentsProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { hasGroupPermission } = usePermissions({ groupId, enabled: true });
  const canDelete = hasGroupPermission('group.task.comment.delete') || permissions.delete;

  const fetchComments = useCallback(() => {
    if (!permissions.read) {
      setLoading(false);
      return;
    }

    getTaskComments({group_id: groupId, task_id: taskId})
      .then((res: any) => {
        const data = res.data?.data || res.data || {};
        // A backend TaskCommentResponse.task_comments tömbjét mentjük
        const commentsList: TaskComment[] = Array.isArray(data.task_comments)
          ? data.task_comments
          : Array.isArray(data)
            ? data
            : [];
        setComments(commentsList);
      })
      .catch(() => toast.error('Hiba a kommentek betöltésekor'))
      .finally(() => setLoading(false));
  }, [groupId, taskId, permissions.read]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  if (!permissions.read) return null;

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !permissions.create) return;

    try {
      const res = await createTaskComment({
        group_id: groupId,
        task_id: taskId,
        text: newComment,
        comment: newComment,
      });
      const raw = res.data?.data || res.data;

      if (raw) {
        // Ha a backend az új kommentet adja vissza, hozzáadjuk a listához
        const newBackendComment: TaskComment = {
          id: raw.id || raw.task_comment_id,
          task_id: raw.task_id || taskId,
          comment: raw.comment || raw.text || newComment,
          created_at: raw.created_at || new Date().toISOString(),
          updated_at: raw.updated_at || raw.created_at || new Date().toISOString(),
          author: raw.author,
        };
        setComments((prev) => [...prev, newBackendComment]);
      }

      setNewComment('');
      toast.success('Komment hozzáadva');
    } catch {
      toast.error('Hiba a komment elküldésekor');
    }
  };

  const executeDelete = async () => {
    if (!confirmDeleteId || !canDelete) return;

    const commentId = confirmDeleteId;
    setConfirmDeleteId(null);
    
    setDeletingId(commentId);
    try {
      await deleteTaskComment({group_id: groupId, task_comment_id: commentId});
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast.success('Komment törölve');
    } catch {
      toast.error('A művelet sikertelen');
    } finally {
      setDeletingId(null);
    }
  };

  /* ── Módosítva logika: created_at vs updated_at ── */
  const isEdited = (created: string, updated: string): boolean => {
    return created !== updated;
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mt-8 flex flex-col gap-5">
        {/* Section Header */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-orange-500/10">
            <MessageCircle size={15} className="text-orange-500" />
          </div>
          <h3 className="font-semibold text-[var(--text-primary)] text-base tracking-tight">
            Kommentek
          </h3>
          {!loading && comments.length > 0 && (
            <span className="text-xs font-bold text-[var(--text-tertiary)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-full px-2 py-0.5 tabular-nums">
              {comments.length}
            </span>
          )}
        </div>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="shrink-0 h-9 w-9 rounded-full bg-[var(--bg-elevated)]" />
                <div className="flex-1 flex flex-col gap-2 pt-1">
                  <div className="flex gap-2">
                    <div className="h-3.5 w-24 rounded bg-[var(--bg-elevated)]" />
                    <div className="h-3.5 w-32 rounded bg-[var(--bg-elevated)]" />
                  </div>
                  <div className="h-10 w-full rounded-lg bg-[var(--bg-elevated)]" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {comments.map((comment) => {
              const authorName = comment.author?.author_fullname || 'Ismeretlen';
              const hasAuthor = !!comment.author?.author_fullname;
              const initials = hasAuthor ? getInitials(authorName) : '?';
              const edited = isEdited(comment.created_at, comment.updated_at);

              return (
                <div
                  key={comment.id}
                  className="relative group flex items-start justify-between py-3 px-2 -mx-2 rounded-xl transition-colors hover:bg-[var(--bg-hover)]/50"
                >
                  {/* Bal oldal: Avatar, Név, Dátum és Szöveg */}
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Avatar */}
                    <div
                      className={`flex shrink-0 h-9 w-9 items-center justify-center rounded-full font-bold text-xs select-none ring-2 ring-offset-1 ring-offset-[var(--bg-primary)] transition-shadow ${
                        hasAuthor
                          ? 'bg-gradient-to-br from-orange-400 to-amber-500 text-white ring-orange-500/20'
                          : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 ring-zinc-400/20'
                      }`}
                    >
                      {initials}
                    </div>

                    {/* Content */}
                    <div className="flex flex-col gap-1 w-full pt-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Author Name */}
                        <span className="font-semibold text-sm text-[var(--text-primary)] truncate max-w-[180px]">
                          {authorName}
                        </span>

                        {/* Email as subtle hint */}
                        {comment.author?.author_email && (
                          <span className="hidden sm:inline text-[11px] text-[var(--text-tertiary)] truncate max-w-[160px]">
                            {comment.author.author_email}
                          </span>
                        )}

                        {/* Separator dot */}
                        <span className="text-[var(--text-tertiary)] text-[8px]">•</span>

                        {/* Created Date */}
                        <span className="text-xs text-[var(--text-tertiary)] whitespace-nowrap">
                          {formatDate(comment.created_at)}
                        </span>

                        {/* Módosítva badge + Tooltip */}
                        {edited && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[11px] text-[var(--text-tertiary)] italic cursor-default select-none opacity-70 hover:opacity-100 transition-opacity">
                                (Módosítva)
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="text-xs">
                                Módosítva: {formatDate(comment.updated_at)}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>

                      {/* Comment body */}
                      <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed break-words mt-0.5">
                        {comment.comment}
                      </div>
                    </div>
                  </div>

                  {/* Jobb oldal: Delete Button */}
                  {canDelete && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setConfirmDeleteId(comment.id)}
                          disabled={deletingId === comment.id}
                          className="shrink-0 p-2 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ml-2 flex items-center justify-center cursor-pointer"
                          aria-label="Komment törlése"
                        >
                          <Trash2 size={16} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Komment törlése</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              );
            })}

            {/* Empty state */}
            {comments.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center bg-[var(--bg-elevated)]/50 rounded-xl border border-dashed border-[var(--border-default)]">
                <div className="flex items-center justify-center h-12 w-12 rounded-full bg-[var(--bg-hover)] mb-3">
                  <MessageCircle size={22} className="text-[var(--text-tertiary)]" />
                </div>
                <p className="text-sm text-[var(--text-tertiary)] italic font-medium">
                  Még senki nem szólt hozzá ehhez a feladathoz.
                </p>
                {permissions.create && (
                  <p className="text-xs text-[var(--text-tertiary)] mt-1 opacity-60">
                    Légy az első, aki hozzászól!
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── New Comment Form ── */}
        {permissions.create && (
          <form onSubmit={handleAddComment} className="mt-2 flex gap-3 items-start">
            {/* Current user avatar placeholder */}
            <div className="flex shrink-0 h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white font-bold text-xs select-none ring-2 ring-emerald-500/20 ring-offset-1 ring-offset-[var(--bg-primary)] mt-0.5">
              ÉN
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Írj egy kommentet..."
                rows={2}
                className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 resize-y transition-all shadow-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    if (newComment.trim()) handleAddComment(e);
                  }
                }}
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--text-tertiary)] opacity-60">
                  Ctrl+Enter a küldéshez
                </span>
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-orange-600 hover:shadow-md hover:shadow-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none active:scale-[0.97]"
                >
                  <Send size={14} /> Küldés
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Komment törlése"
        message="Biztosan törölni szeretnéd ezt a kommentet? Ez a művelet nem vonható vissza."
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={executeDelete}
        confirmLabel="Törlés"
        cancelLabel="Mégse"
      />
    </TooltipProvider>
  );
}
