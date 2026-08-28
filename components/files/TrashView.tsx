'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { getTrash, restoreFile, permanentDeleteFile, type FileInTrashOut } from '@/lib/api/files';
import { translateFileApiError } from '@/lib/i18n/files';
import { formatFileSize, formatMimeType, formatUploadedAt } from '@/lib/utils/formatFiles';

const DEFAULT_LIMIT = 20;

export default function TrashView() {
  const t = useTranslations('files');

  const [items, setItems] = useState<FileInTrashOut[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(DEFAULT_LIMIT);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const refetch = useCallback(() => setRefreshKey((key) => key + 1), []);

  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileInTrashOut | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      try {
        const response = await getTrash(offset, limit);
        if (!mounted) return;
        setItems(response.data.items);
        setTotal(response.data.total);
      } catch (error) {
        if (!mounted) return;
        setItems([]);
        setTotal(0);
        toast.error(translateFileApiError(t, error, 'errors.default'));
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [offset, limit, refreshKey, t]);

  const handleRestore = async (fileId: string) => {
    if (restoringId) return;
    setRestoringId(fileId);
    try {
      await restoreFile(fileId);
      toast.success(t('toasts.restoreSuccess'));
      refetch();
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await permanentDeleteFile(deleteTarget.id);
      toast.success(t('toasts.permanentDeleteSuccess'));
      setDeleteTarget(null);
      refetch();
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<FileInTrashOut>[] = [
    { key: 'original_name', label: t('table.name') },
    { key: 'mime_type', label: t('table.type'), render: (value) => formatMimeType(value as string | null) },
    { key: 'size_bytes', label: t('table.size'), render: (value) => formatFileSize(value as number | null) },
    {
      key: 'deleted_at',
      label: t('trash.table.deletedAt'),
      render: (value) => (value ? formatUploadedAt(String(value)) : '-'),
    },
    {
      key: 'id',
      label: t('table.actions'),
      render: (value, row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            loading={restoringId === row.id}
            onClick={() => handleRestore(row.id)}
          >
            {t('trash.restore')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setDeleteTarget(row)}
          >
            {t('trash.permanentDelete')}
          </Button>
        </div>
      ),
    },
  ];

  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <section className="space-y-4">
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t('trash.title')}</h1>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={items}
          emptyState={<span className="text-sm text-[var(--text-tertiary)]">{t('trash.emptyText')}</span>}
        />
      )}

      {!isLoading && total > limit && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-tertiary)]">
            {t('table.pagination.range', {
              from: total === 0 ? 0 : offset + 1,
              to: Math.min(offset + limit, total),
              total,
            })}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!hasPrev}
              onClick={() => setOffset((current) => Math.max(0, current - limit))}
            >
              {t('table.pagination.prev')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!hasNext}
              onClick={() => setOffset((current) => current + limit)}
            >
              {t('table.pagination.next')}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t('trash.confirmPermanentTitle')}
        message={t('trash.confirmPermanentMessage')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!isDeleting) {
            void handlePermanentDeleteConfirm();
          }
        }}
      />
    </section>
  );
}
