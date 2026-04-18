import {useEffect, useState} from 'react';
import {getTaskComments, createTaskComment, deleteTaskComment} from '@/lib/api/tasks';
import {TaskComment} from './types';
import {Trash2, Send} from 'lucide-react';
import toast from 'react-hot-toast';

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

export default function TaskComments({groupId, taskId, permissions}: TaskCommentsProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (!permissions.read) {
      setLoading(false);
      return;
    }
    
    getTaskComments({group_id: groupId, task_id: taskId})
      .then((res: any) => {
        const data = res.data?.data || res.data || {};
        const commentsList = Array.isArray(data.task_comments) ? data.task_comments : (Array.isArray(data) ? data : []);
        
        const mappedComments = commentsList.map((c: any) => ({
          ...c,
          task_comment_id: c.task_comment_id || c.id,
          text: c.text || c.comment
        }));

        setComments(mappedComments);
      })
      .catch(() => toast.error('Hiba a kommentek betöltésekor'))
      .finally(() => setLoading(false));
  }, [groupId, taskId, permissions.read]);

  if (!permissions.read) return null;

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !permissions.create) return;

    try {
      const res = await createTaskComment({
        group_id: groupId,
        task_id: taskId,
        text: newComment,
        comment: newComment // send both in case backend expects `comment` based on prompt
      });
      const newBackendComment = res.data?.data || res.data;
      if (newBackendComment) {
        const mappedNewComment = {
          ...newBackendComment,
          task_comment_id: newBackendComment.task_comment_id || newBackendComment.id,
          text: newBackendComment.text || newBackendComment.comment
        };
        setComments((prev) => [...prev, mappedNewComment]);
      }
      
      setNewComment('');
      toast.success('Komment hozzáadva');
    } catch {
      toast.error('Hiba a komment elküldésekor');
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!permissions.delete) return;
    try {
      await deleteTaskComment({group_id: groupId, task_comment_id: commentId});
      setComments((prev) => prev.filter(c => c.task_comment_id !== commentId));
      toast.success('Komment törölve');
    } catch {
      toast.error('Hiba a komment törlésekor');
    }
  };

  return (
    <div className="mt-8 flex flex-col gap-4">
      <h3 className="font-semibold text-[var(--text-primary)]">Kommentek</h3>
      
      {loading ? (
        <div className="h-10 w-full animate-pulse rounded bg-[var(--bg-elevated)]" />
      ) : (
        <div className="flex flex-col gap-5">
          {comments.map((comment) => {
            const author = comment.creator_name || 'Ismeretlen';
            const initials = author.substring(0, 2).toUpperCase();
            
            return (
              <div key={comment.task_comment_id} className="flex gap-3 group">
                {/* Avatar Placeholder */}
                <div className="flex shrink-0 h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs select-none">
                  {initials}
                </div>
                
                <div className="flex flex-col gap-1 w-full pt-1">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[var(--text-primary)]">{author}</span>
                      <span className="text-xs text-[var(--text-tertiary)]" title={new Date(comment.created_at).toLocaleString()}>
                        {new Date(comment.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {permissions.delete && (
                      <button 
                        onClick={() => handleDelete(comment.task_comment_id)} 
                        className="text-[var(--text-tertiary)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-red-50"
                        title="Komment törlése"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  
                  <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                    {comment.text}
                  </div>
                </div>
              </div>
            );
          })}
          {comments.length === 0 && (
            <div className="text-center py-6 text-sm text-[var(--text-tertiary)] italic bg-[var(--bg-elevated)] rounded-lg border border-dashed border-[var(--border-default)]">
              Még senki nem szólt hozzá ehhez a feladathoz.
            </div>
          )}
        </div>
      )}

      {permissions.create && (
        <form onSubmit={handleAddComment} className="mt-4 flex gap-3 items-start">
          <div className="flex shrink-0 h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-gray-500 font-bold text-xs select-none mt-1">
            TE
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Írj egy kommentet..."
              rows={2}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-y"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!newComment.trim()}
                className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={14} /> Küldés
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
