'use client';

import {useCallback, useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {RotateCcw, Trash2} from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {getPostTrash, purgePosts, restorePosts} from '@/lib/api/posts';
import {findArray} from '@/lib/posts/model';
import {formatDateTime} from '@/components/posts/PostReadScreen';

interface TrashItem {
  id: string;
  title: string;
  deletedAt: string;
  purgeAfter: string;
}

interface PostTrashViewProps {
  groupId?: string;
  canRestore: boolean;
  canPurge: boolean;
  onRestored: () => void;
}

const daysLeft = (iso: string): number | null => {
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return null;
  return Math.max(0, Math.ceil((at - Date.now()) / 86_400_000));
};

export default function PostTrashView({groupId, canRestore, canPurge, onRestored}: PostTrashViewProps) {
  const t = useTranslations('posts.trash');
  const postsT = useTranslations('posts');
  const locale = useLocale();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [purgeTarget, setPurgeTarget] = useState<TrashItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getPostTrash(groupId, 1, 100);
      setItems(
        findArray(response.data, ['posts']).map((item) => {
          const row = (item ?? {}) as Record<string, unknown>;
          return {
            id: String(row.post_id ?? ''),
            title: String(row.title ?? ''),
            deletedAt: String(row.deleted_at ?? ''),
            purgeAfter: String(row.purge_after ?? '')
          };
        })
      );
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

  const restore = async (item: TrashItem) => {
    setBusyId(item.id);
    try {
      await restorePosts(groupId, [item.id]);
      toast.success(t('restored'));
      await load();
      onRestored();
    } catch {
      toast.error(t('restoreError'));
    } finally {
      setBusyId('');
    }
  };

  const purge = async () => {
    const item = purgeTarget;
    setPurgeTarget(null);
    if (!item) return;
    setBusyId(item.id);
    try {
      await purgePosts(groupId, [item.id]);
      toast.success(t('purged'));
      await load();
    } catch {
      toast.error(t('purgeError'));
    } finally {
      setBusyId('');
    }
  };

  if (loading) {
    return <div className="surface rounded-xl p-4 text-sm text-[var(--text-secondary)]">{postsT('loading')}</div>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-tertiary)]">{t('retentionNote')}</p>
      {items.length === 0 ? (
        <div className="empty-state surface">
          <div className="empty-state-icon">
            <Trash2 size={40} />
          </div>
          <h3 className="empty-state-title">{t('empty')}</h3>
        </div>
      ) : (
        <ul className="surface divide-y divide-[var(--border-subtle)] rounded-xl">
          {items.map((item, index) => {
            const left = daysLeft(item.purgeAfter);
            return (
              <li key={`${index}-${item.deletedAt}`} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">{item.title || postsT('untitled')}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                    {t('deletedAt', {value: formatDateTime(item.deletedAt, locale, '—')})}
                    {left != null && <> · {left === 0 ? t('purgeSoon') : t('daysLeft', {count: left})}</>}
                  </p>
                </div>
                <div className="flex gap-2">
                  {canRestore && (
                    <Button size="sm" startIcon={<RotateCcw size={14} />} disabled={busyId === item.id} onClick={() => void restore(item)}>
                      {t('restore')}
                    </Button>
                  )}
                  {canPurge && (
                    <Button size="sm" variant="danger" startIcon={<Trash2 size={14} />} disabled={busyId === item.id} onClick={() => setPurgeTarget(item)}>
                      {t('purge')}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(purgeTarget)}
        title={t('purgeTitle')}
        message={t('purgeMessage')}
        onCancel={() => setPurgeTarget(null)}
        onConfirm={() => void purge()}
      />
    </div>
  );
}
