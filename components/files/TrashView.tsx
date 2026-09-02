'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { Folder } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { getTrash, restoreFile, permanentDeleteFile, type FileInTrashOut } from '@/lib/api/files';
import { getFolderTrash, restoreFolder, permanentDeleteFolder, type FolderInTrashOut } from '@/lib/api/folders';
import { translateFileApiError } from '@/lib/i18n/files';
import { translateFolderApiError } from '@/lib/i18n/folders';
import { usePagedDualList } from '@/hooks/usePagedDualList';
import { formatFileSize, formatMimeType, formatUploadedAt } from '@/lib/utils/formatFiles';

type TrashEntry = ({ kind: 'file' } & FileInTrashOut) | ({ kind: 'folder' } & FolderInTrashOut);

const PAGE_SIZE = 20;

export default function TrashView() {
  const t = useTranslations('files');
  const tf = useTranslations('folders');

  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TrashEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    listA: fileItems,
    listB: folderItems,
    isLoading,
    hasMore,
    loadMore,
    reset: refetch,
  } = usePagedDualList(
    async (offset, limit) => {
      try {
        const [filesResponse, foldersResponse] = await Promise.all([getTrash(offset, limit), getFolderTrash(offset, limit)]);
        return {
          listA: filesResponse.data.items,
          listB: foldersResponse.data.items,
          totalA: filesResponse.data.total,
          totalB: foldersResponse.data.total,
        };
      } catch (error) {
        toast.error(translateFileApiError(t, error, 'errors.default'));
        throw error;
      }
    },
    PAGE_SIZE,
    []
  );

  const entries: TrashEntry[] = [
    ...folderItems.map((item) => ({ kind: 'folder' as const, ...item })),
    ...fileItems.map((item) => ({ kind: 'file' as const, ...item })),
  ];

  const handleRestore = async (entry: TrashEntry) => {
    if (restoringId) return;
    setRestoringId(entry.id);
    try {
      if (entry.kind === 'file') {
        await restoreFile(entry.id);
        toast.success(t('toasts.restoreSuccess'));
      } else {
        await restoreFolder(entry.id);
        toast.success(tf('toasts.restoreSuccess'));
      }
      refetch();
    } catch (error) {
      toast.error(entry.kind === 'file' ? translateFileApiError(t, error, 'errors.default') : translateFolderApiError(tf, error, 'errors.default'));
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.kind === 'file') {
        await permanentDeleteFile(deleteTarget.id);
        toast.success(t('toasts.permanentDeleteSuccess'));
      } else {
        await permanentDeleteFolder(deleteTarget.id);
        toast.success(tf('toasts.permanentDeleteSuccess'));
      }
      setDeleteTarget(null);
      refetch();
    } catch (error) {
      toast.error(deleteTarget.kind === 'file' ? translateFileApiError(t, error, 'errors.default') : translateFolderApiError(tf, error, 'errors.default'));
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<TrashEntry>[] = [
    {
      key: 'name',
      label: t('table.name'),
      render: (_value, row) => (
        <span className="flex items-center gap-2">
          {row.kind === 'folder' && <Folder size={16} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />}
          {row.kind === 'file' ? row.original_name : row.name}
        </span>
      ),
    },
    { key: 'type', label: t('table.type'), render: (_value, row) => (row.kind === 'folder' ? t('table.folderType') : formatMimeType(row.mime_type)) },
    { key: 'size', label: t('table.size'), render: (_value, row) => (row.kind === 'folder' ? '-' : formatFileSize(row.size_bytes)) },
    { key: 'deletedAt', label: t('trash.table.deletedAt'), render: (_value, row) => (row.deleted_at ? formatUploadedAt(row.deleted_at) : '-') },
    {
      key: 'actions',
      label: t('table.actions'),
      render: (_value, row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" loading={restoringId === row.id} onClick={() => handleRestore(row)}>{t('trash.restore')}</Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteTarget(row)}>{t('trash.permanentDelete')}</Button>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t('trash.title')}</h1>
      <p className="text-xs text-[var(--text-tertiary)]">{tf('trashHelperText')}</p>

      {isLoading && entries.length === 0 ? (
        <div className="space-y-2">
          <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState>{t('trash.emptyText')}</EmptyState>
      ) : (
        <DataTable columns={columns} rows={entries} emptyState={<span className="text-sm text-[var(--text-tertiary)]">{t('trash.emptyText')}</span>} />
      )}

      {!isLoading && hasMore && (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" onClick={loadMore}>{t('table.loadMore')}</Button>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t('trash.confirmPermanentTitle')}
        message={deleteTarget?.kind === 'folder' ? tf('confirmPermanentDelete.message') : t('trash.confirmPermanentMessage')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!isDeleting) void handlePermanentDeleteConfirm();
        }}
      />
    </section>
  );
}
