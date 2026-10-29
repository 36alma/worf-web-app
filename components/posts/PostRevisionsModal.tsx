'use client';

import {useEffect, useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {History, RotateCcw} from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import {getPostRevision, getPostRevisions, restorePostRevision} from '@/lib/api/posts';
import {bodyToText, findArray, readData} from '@/lib/posts/model';
import {diffLines} from '@/lib/utils/lineDiff';
import {formatDateTime} from '@/components/posts/PostReadScreen';

interface RevisionSummary {
  version: number;
  title: string;
  editor: string;
  createdAt: string;
}

interface RevisionDetail {
  version: number;
  title: string;
  content: string;
}

interface PostRevisionsModalProps {
  open: boolean;
  groupId?: string;
  postId: string;
  current: {title: string; body: string};
  /** Pending posts cannot be edited, so restoring is offered only when this is true. */
  canRestore: boolean;
  onClose: () => void;
  onRestored: () => void;
}

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const normalizeSummary = (item: unknown): RevisionSummary | null => {
  const row = toRecord(item);
  const version = Number(row.version);
  if (!Number.isFinite(version)) return null;
  const editor = toRecord(row.edited_by ?? row.author);
  return {
    version,
    title: String(row.title ?? ''),
    editor: String(editor.name ?? row.edited_by_name ?? row.author_name ?? ''),
    createdAt: String(row.created_at ?? row.edited_at ?? '')
  };
};

export default function PostRevisionsModal({open, groupId, postId, current, canRestore, onClose, onRestored}: PostRevisionsModalProps) {
  const t = useTranslations('posts.revisions');
  const locale = useLocale();
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<RevisionDetail | null>(null);
  const [restoreVersion, setRestoreVersion] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      return;
    }
    let mounted = true;
    setLoading(true);
    // Max 20 revisions are kept, so one page always holds them all.
    getPostRevisions(groupId, postId, 1, 20)
      .then((response) => {
        if (!mounted) return;
        setRevisions(
          findArray(response.data, ['revisions'])
            .map(normalizeSummary)
            .filter((row): row is RevisionSummary => Boolean(row))
        );
      })
      .catch(() => mounted && toast.error(t('loadError')))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [groupId, open, postId, t]);

  const openVersion = async (version: number) => {
    try {
      const response = await getPostRevision(groupId, postId, version);
      const root = toRecord(readData(response.data));
      const row = toRecord(root.revision ?? root);
      setSelected({version, title: String(row.title ?? ''), content: String(row.content ?? '')});
    } catch {
      toast.error(t('loadError'));
    }
  };

  const confirmRestore = async () => {
    if (restoreVersion == null) return;
    const version = restoreVersion;
    setRestoreVersion(null);
    try {
      await restorePostRevision(groupId, postId, version);
      toast.success(t('restored', {version}));
      onRestored();
      onClose();
    } catch {
      toast.error(t('restoreError'));
    }
  };

  const diff = useMemo(
    () =>
      selected
        ? diffLines(`${selected.title}\n\n${bodyToText(selected.content)}`, `${current.title}\n\n${bodyToText(current.body)}`)
        : [],
    [current.body, current.title, selected]
  );

  return (
    <Modal open={open} title={t('title')} badge={revisions.length} onClose={onClose}>
      {selected ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
              ← {t('backToList')}
            </Button>
            {canRestore && (
              <Button size="sm" startIcon={<RotateCcw size={14} />} onClick={() => setRestoreVersion(selected.version)}>
                {t('restore')}
              </Button>
            )}
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">{t('diffLegend', {version: selected.version})}</p>
          <pre className="max-h-[55dvh] overflow-auto whitespace-pre-wrap break-words rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-[13px] leading-relaxed">
            {diff.map((line, index) => (
              <div
                key={index}
                className={
                  line.kind === 'added'
                    ? 'bg-[rgba(34,197,94,0.12)] text-[var(--text-primary)]'
                    : line.kind === 'removed'
                      ? 'bg-[rgba(239,68,68,0.12)] text-[var(--text-secondary)] line-through'
                      : 'text-[var(--text-secondary)]'
                }
              >
                {line.kind === 'added' ? '+ ' : line.kind === 'removed' ? '− ' : '  '}
                {line.text || ' '}
              </div>
            ))}
          </pre>
        </div>
      ) : loading ? (
        <p className="text-sm text-[var(--text-tertiary)]">{t('loading')}</p>
      ) : revisions.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)]">{t('empty')}</p>
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)]">
          {revisions.map((revision) => (
            <li key={revision.version} className="flex items-center justify-between gap-3 py-2">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void openVersion(revision.version)}>
                <span className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <History size={14} className="shrink-0 text-[var(--text-tertiary)]" />
                  <span className="truncate">
                    v{revision.version} · {revision.title || t('untitled')}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-[var(--text-tertiary)]">
                  {[revision.editor, formatDateTime(revision.createdAt, locale, '')].filter(Boolean).join(' · ')}
                </span>
              </button>
              <Button size="sm" variant="ghost" onClick={() => void openVersion(revision.version)}>
                {t('compare')}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={restoreVersion != null}
        title={t('restoreTitle')}
        message={t('restoreMessage', {version: restoreVersion ?? 0})}
        onCancel={() => setRestoreVersion(null)}
        onConfirm={() => void confirmRestore()}
      />
    </Modal>
  );
}
