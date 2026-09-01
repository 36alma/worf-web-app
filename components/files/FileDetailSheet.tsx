'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import * as Tabs from '@radix-ui/react-tabs';
import clsx from 'clsx';
import { Eye, FileText, History, Pencil, Share2, Star } from 'lucide-react';
import SideSheet from '@/components/ui/SideSheet';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Button from '@/components/ui/Button';
import {
  getFileMetadata,
  requestDownload,
  buildDownloadUrl,
  deleteFile,
  renameFile,
  starFile,
  unstarFile,
  getAuditLog,
  type FileMetadataResponse,
  type FileAuditLogEntry,
} from '@/lib/api/files';
import { translateFileApiError } from '@/lib/i18n/files';
import { formatFileSize, formatMimeType, formatUploadedAt } from '@/lib/utils/formatFiles';
import NameDialog from './NameDialog';
import ShareModal from './ShareModal';

const AUDIT_PAGE_SIZE = 20;

export interface FileDetailSheetProps {
  fileId: string | null;
  onClose: () => void;
  onDeleted?: () => void;
  onChanged?: () => void;
  onPreview?: (fileId: string) => void;
  /**
   * When true, hides Rename/Share/Star/Delete entirely (not just disables
   * them) and shows only Download + the optional Preview shortcut. Used by
   * SharedWithMeView per backend spec §9.3: shared-with-me items always have
   * is_owner: false and the UI must offer a reduced action set — view/preview
   * + download only. Defaults to false, so FilesFeed's and StarredView's
   * full-featured usage is unaffected.
   */
  readOnly?: boolean;
}

const DOWNLOAD_DEBOUNCE_MS = 2000;

export default function FileDetailSheet({ fileId, onClose, onDeleted, onChanged, onPreview, readOnly = false }: FileDetailSheetProps) {
  const t = useTranslations('files');

  const [activeTab, setActiveTab] = useState('metadata');
  const [metadata, setMetadata] = useState<FileMetadataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);

  const [auditItems, setAuditItems] = useState<FileAuditLogEntry[]>([]);
  const [auditOffset, setAuditOffset] = useState(0);
  const [auditTotal, setAuditTotal] = useState(0);
  const [isAuditLoading, setIsAuditLoading] = useState(false);

  const loadMetadata = useCallback(async () => {
    if (fileId === null) return;
    setIsLoading(true);
    try {
      const response = await getFileMetadata(fileId);
      setMetadata(response.data);
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    } finally {
      setIsLoading(false);
    }
  }, [fileId, t]);

  useEffect(() => {
    if (fileId === null) {
      setMetadata(null);
      setActiveTab('metadata');
      setAuditItems([]);
      setAuditOffset(0);
      setAuditTotal(0);
      return;
    }
    void loadMetadata();
  }, [fileId, loadMetadata]);

  const loadAudit = useCallback(
    async (nextOffset: number) => {
      if (fileId === null) return;
      setIsAuditLoading(true);
      try {
        const response = await getAuditLog(fileId, nextOffset, AUDIT_PAGE_SIZE);
        setAuditItems((current) => (nextOffset === 0 ? response.data.items : [...current, ...response.data.items]));
        setAuditTotal(response.data.total);
        setAuditOffset(nextOffset);
      } catch (error) {
        toast.error(translateFileApiError(t, error, 'errors.default'));
      } finally {
        setIsAuditLoading(false);
      }
    },
    [fileId, t]
  );

  useEffect(() => {
    if (fileId === null || activeTab !== 'audit') return;
    void loadAudit(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, fileId]);

  const handleDownload = async () => {
    if (fileId === null || isRequesting) return;
    setIsRequesting(true);
    try {
      const response = await requestDownload(fileId);
      window.location.href = buildDownloadUrl(response.data.download_token);
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    } finally {
      setTimeout(() => setIsRequesting(false), DOWNLOAD_DEBOUNCE_MS);
    }
  };

  const handleToggleStar = async () => {
    if (fileId === null || !metadata) return;
    try {
      if (metadata.is_starred) await unstarFile(fileId);
      else await starFile(fileId);
      await loadMetadata();
      onChanged?.();
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    }
  };

  const handleRename = async (name: string) => {
    if (fileId === null) return;
    try {
      await renameFile(fileId, name);
      toast.success(t('toasts.renameSuccess'));
      await loadMetadata();
      onChanged?.();
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
      throw error;
    }
  };

  const handleDeleteConfirm = async () => {
    if (fileId === null) return;
    setIsDeleting(true);
    try {
      await deleteFile(fileId);
      toast.success(t('toasts.deleteSuccess'));
      setIsConfirmOpen(false);
      onClose();
      onDeleted?.();
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <SideSheet open={fileId !== null} title={t('detail.title')} onClose={onClose}>
        <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex h-full w-full flex-col">
          <Tabs.List className="mb-6 mt-[-10px] flex border-b border-[var(--border-subtle)]">
            <Tabs.Trigger value="metadata" className={clsx('flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold outline-none transition-all', activeTab === 'metadata' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]')}>
              <FileText size={16} /> {t('detail.tabs.metadata')}
            </Tabs.Trigger>
            <Tabs.Trigger value="audit" className={clsx('flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold outline-none transition-all', activeTab === 'audit' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]')}>
              <History size={16} /> {t('detail.tabs.audit')}
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="metadata" className="flex flex-col gap-4 outline-none">
            {isLoading || !metadata ? (
              <div className="space-y-2">
                <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
                <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
                <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
              </div>
            ) : (
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{t('detail.fields.name')}</dt>
                  <dd className="flex items-center gap-2 text-right font-medium text-[var(--text-primary)]">
                    {metadata.original_name}
                    {!readOnly && (
                      <button type="button" onClick={() => setIsRenameOpen(true)} aria-label={t('table.rename')} className="rounded p-1 hover:bg-[var(--bg-hover)]">
                        <Pencil size={14} strokeWidth={1.75} className="text-[var(--text-tertiary)]" />
                      </button>
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{t('detail.fields.type')}</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">{formatMimeType(metadata.mime_type)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{t('detail.fields.size')}</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">{formatFileSize(metadata.size_bytes)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{t('detail.fields.uploadedAt')}</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">{formatUploadedAt(metadata.uploaded_at)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{t('detail.fields.scope')}</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">{metadata.scope === 'group' ? t('detail.scopeValues.group') : t('detail.scopeValues.private')}</dd>
                </div>
              </dl>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="primary" onClick={handleDownload} disabled={fileId === null || isRequesting}>{t('detail.download')}</Button>
              {onPreview && metadata?.mime_type?.startsWith('image/') && (
                <Button type="button" variant="secondary" onClick={() => fileId && onPreview(fileId)}>
                  <Eye size={16} strokeWidth={1.75} className="mr-1.5" /> {t('preview.details')}
                </Button>
              )}
              {!readOnly && (
                <>
                  <Button type="button" variant="secondary" onClick={() => setIsShareOpen(true)}>
                    <Share2 size={16} strokeWidth={1.75} className="mr-1.5" /> {t('share.modalTitle')}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => void handleToggleStar()} disabled={!metadata}>
                    <Star size={16} strokeWidth={1.75} className={clsx('mr-1.5', metadata?.is_starred && 'fill-[var(--accent)] text-[var(--accent)]')} />
                    {metadata?.is_starred ? t('table.unstar') : t('table.star')}
                  </Button>
                  <Button type="button" variant="danger" onClick={() => setIsConfirmOpen(true)} disabled={fileId === null || isLoading}>{t('detail.delete')}</Button>
                </>
              )}
            </div>
          </Tabs.Content>

          <Tabs.Content value="audit" className="flex flex-col gap-4 outline-none">
            {isAuditLoading && auditItems.length === 0 ? (
              <div className="space-y-2">
                <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
                <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
              </div>
            ) : auditItems.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">{t('audit.emptyText')}</p>
            ) : (
              <ul className="space-y-2">
                {auditItems.map((entry) => (
                  <li key={entry.id} className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-[var(--text-primary)]">
                        {t.has(`audit.action.${entry.action}` as never) ? t(`audit.action.${entry.action}` as never) : entry.action}
                      </span>
                      <span className="text-xs text-[var(--text-tertiary)]">{formatUploadedAt(entry.timestamp)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {auditItems.length < auditTotal && (
              <Button type="button" variant="secondary" size="sm" loading={isAuditLoading} onClick={() => loadAudit(auditOffset + AUDIT_PAGE_SIZE)}>{t('audit.loadMore')}</Button>
            )}
          </Tabs.Content>
        </Tabs.Root>
      </SideSheet>

      {!readOnly && (
        <>
          <ConfirmDialog
            open={isConfirmOpen}
            title={t('detail.confirmDelete.title')}
            message={t('detail.confirmDelete.message')}
            onCancel={() => setIsConfirmOpen(false)}
            onConfirm={() => { if (!isDeleting) void handleDeleteConfirm(); }}
          />

          <NameDialog
            open={isRenameOpen}
            title={t('rename.fileTitle')}
            label={t('rename.label')}
            initialValue={metadata?.original_name ?? ''}
            submitLabel={t('rename.submit')}
            onSubmit={handleRename}
            onClose={() => setIsRenameOpen(false)}
          />

          {fileId !== null && (
            <ShareModal open={isShareOpen} kind="file" entityId={fileId} isOwner={metadata?.is_owner ?? false} onClose={() => setIsShareOpen(false)} />
          )}
        </>
      )}
    </>
  );
}
