'use client';

import {useCallback, useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {Check, ChevronDown, ClipboardCheck, X} from 'lucide-react';
import Button from '@/components/ui/Button';
import MarkdownRenderer from '@/components/posts/MarkdownRenderer';
import RejectReviewModal from '@/components/posts/RejectReviewModal';
import {approvePostReview, getPendingPostReviews, rejectPostReview} from '@/lib/api/posts';
import {findArray, httpStatus, numberField} from '@/lib/posts/model';
import {formatDateTime} from '@/components/posts/PostReadScreen';

interface PendingItem {
  key: string;
  id: string;
  title: string;
  content: string;
  author: string;
  submittedAt: string;
}

interface PostReviewQueueProps {
  groupId?: string;
  onChanged: () => void;
}

export default function PostReviewQueue({groupId, onChanged}: PostReviewQueueProps) {
  const t = useTranslations('posts.review');
  const postsT = useTranslations('posts');
  const locale = useLocale();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [rejecting, setRejecting] = useState<PendingItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getPendingPostReviews(groupId, 1, 50);
      const rows = findArray(response.data, ['pending']).map((item, index) => {
        const row = (item ?? {}) as Record<string, unknown>;
        const author = (row.author && typeof row.author === 'object' ? row.author : {}) as Record<string, unknown>;
        return {
          key: `${index}-${String(row.submitted_at ?? '')}`,
          id: String(row.post_id ?? ''),
          title: String(row.title ?? ''),
          content: String(row.content ?? ''),
          author: String(author.name ?? (typeof row.author === 'string' ? row.author : '')),
          submittedAt: String(row.submitted_at ?? '')
        };
      });
      setItems(rows);
      setTotal(numberField(response.data, ['total_pending'], rows.length));
    } catch {
      setItems([]);
      toast.error(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [groupId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (item: PendingItem, decision: 'approve' | 'reject', comment = '') => {
    setBusyKey(item.key);
    try {
      if (decision === 'approve') {
        await approvePostReview(groupId, item.id);
        toast.success(t('approved'));
      } else {
        await rejectPostReview(groupId, item.id, comment);
        toast.success(t('rejected'));
      }
      setRejecting(null);
      await load();
      onChanged();
    } catch (error) {
      toast.error(httpStatus(error) === 403 ? t('ownPostForbidden') : t('decisionError'));
    } finally {
      setBusyKey('');
    }
  };

  if (loading) {
    return <div className="surface rounded-xl p-4 text-sm text-[var(--text-secondary)]">{postsT('loading')}</div>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-tertiary)]">{t('queueNote', {count: total})}</p>
      {items.length === 0 ? (
        <div className="empty-state surface">
          <div className="empty-state-icon">
            <ClipboardCheck size={40} />
          </div>
          <h3 className="empty-state-title">{t('queueEmpty')}</h3>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const open = expanded === item.key;
            return (
              <li key={item.key} className="surface rounded-xl p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setExpanded(open ? '' : item.key)}>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)]">
                      <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
                      <span className="truncate">{item.title || postsT('untitled')}</span>
                    </span>
                    <span className="mt-0.5 block pl-5 text-xs text-[var(--text-tertiary)]">
                      {[item.author || postsT('unknownAuthor'), t('submittedAt', {value: formatDateTime(item.submittedAt, locale, '—')})].join(' · ')}
                    </span>
                  </button>
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" startIcon={<Check size={14} />} disabled={busyKey === item.key} onClick={() => void decide(item, 'approve')}>
                      {t('approve')}
                    </Button>
                    <Button size="sm" variant="danger" startIcon={<X size={14} />} disabled={busyKey === item.key} onClick={() => setRejecting(item)}>
                      {t('reject')}
                    </Button>
                  </div>
                </div>
                {open && (
                  <MarkdownRenderer content={item.content} className="mt-3 border-t border-[var(--border-subtle)] pt-3" />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <RejectReviewModal
        open={Boolean(rejecting)}
        postTitle={rejecting?.title || postsT('untitled')}
        busy={Boolean(rejecting && busyKey === rejecting.key)}
        onCancel={() => setRejecting(null)}
        onConfirm={(comment) => rejecting && void decide(rejecting, 'reject', comment)}
      />
    </div>
  );
}
