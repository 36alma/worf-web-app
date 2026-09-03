'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import * as Tabs from '@radix-ui/react-tabs';
import clsx from 'clsx';
import { FileText, History, Pencil, Share2, Star } from 'lucide-react';
import SideSheet from '@/components/ui/SideSheet';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Button from '@/components/ui/Button';
import {
  getFolderMetadata,
  deleteFolder,
  renameFolder,
  starFolder,
  unstarFolder,
  getFolderAuditLog,
  type FolderMetadataResponse,
} from '@/lib/api/folders';
import { translateFolderApiError } from '@/lib/i18n/folders';
import { formatUploadedAt } from '@/lib/utils/formatFiles';
import NameDialog from './NameDialog';
import ShareModal from './ShareModal';

const AUDIT_PAGE_SIZE = 20;

export interface FolderDetailSheetProps {
  folderId: string | null;
  onClose: () => void;
  onDeleted?: () => void;
  onRenamed?: () => void;
  onChanged?: () => void;
  /**
   * When true, hides Rename/Share/Star/Delete entirely (not just disables
   * them) and shows only the metadata/log tabs — same convention as
   * FileDetailSheet's `readOnly` (SharedWithMeView per backend spec §9.3).
   */
  readOnly?: boolean;
}

interface AuditEntry {
  id: string;
  action: string;
  timestamp: string;
}

export default function FolderDetailSheet({ folderId, onClose, onDeleted, onRenamed, onChanged, readOnly = false }: FolderDetailSheetProps) {
  const t = useTranslations('files');
  const tf = useTranslations('folders');

  const [activeTab, setActiveTab] = useState('metadata');
  const [metadata, setMetadata] = useState<FolderMetadataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);

  const [auditItems, setAuditItems] = useState<AuditEntry[]>([]);
  const [auditOffset, setAuditOffset] = useState(0);
  const [auditTotal, setAuditTotal] = useState(0);
  const [isAuditLoading, setIsAuditLoading] = useState(false);

  const loadMetadata = useCallback(async () => {
    if (folderId === null) return;
    setIsLoading(true);
    try {
      const response = await getFolderMetadata(folderId);
      setMetadata(response.data);
    } catch (error) {
      toast.error(translateFolderApiError(tf, error, 'errors.default'));
    } finally {
      setIsLoading(false);
    }
  }, [folderId, tf]);

  useEffect(() => {
    if (folderId === null) {
      setMetadata(null);
      setActiveTab('metadata');
      setAuditItems([]);
      setAuditOffset(0);
      setAuditTotal(0);
      return;
    }
    void loadMetadata();
  }, [folderId, loadMetadata]);

  const loadAudit = useCallback(
    async (nextOffset: number) => {
      if (folderId === null) return;
      setIsAuditLoading(true);
      try {
        const response = await getFolderAuditLog(folderId, nextOffset, AUDIT_PAGE_SIZE);
        setAuditItems((current) => (nextOffset === 0 ? response.data.items : [...current, ...response.data.items]));
        setAuditTotal(response.data.total);
        setAuditOffset(nextOffset);
      } catch (error) {
        toast.error(translateFolderApiError(tf, error, 'errors.default'));
      } finally {
        setIsAuditLoading(false);
      }
    },
    [folderId, tf]
  );

  useEffect(() => {
    if (folderId === null || activeTab !== 'audit') return;
    void loadAudit(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, folderId]);

  const handleToggleStar = async () => {
    if (folderId === null || !metadata) return;
    try {
      if (metadata.is_starred) await unstarFolder(folderId);
      else await starFolder(folderId);
      await loadMetadata();
      onChanged?.();
    } catch (error) {
      toast.error(translateFolderApiError(tf, error, 'errors.default'));
    }
  };

  const handleRename = async (name: string) => {
    if (folderId === null) return;
    try {
      await renameFolder(folderId, name);
      await loadMetadata();
      onChanged?.();
      onRenamed?.();
    } catch (error) {
      toast.error(translateFolderApiError(tf, error, 'errors.default'));
      throw error;
    }
  };

  const handleDeleteConfirm = async () => {
    if (folderId === null) return;
    setIsDeleting(true);
    try {
      await deleteFolder(folderId);
      toast.success(tf('toasts.deleteSuccess'));
      setIsConfirmOpen(false);
      onClose();
      onDeleted?.();
    } catch (error) {
      toast.error(translateFolderApiError(tf, error, 'errors.default'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Same gating convention as FileDetailSheet: Rename/Share/Delete require
  // genuine ownership, Star only requires !readOnly.
  const canManage = !readOnly && (metadata?.is_owner ?? false);

  return (
    <>
      <SideSheet open={folderId !== null} title={tf('detail.title')} onClose={onClose}>
        <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex h-full w-full flex-col">
          <Tabs.List className="mb-6 mt-[-10px] flex border-b border-[var(--border-subtle)]">
            <Tabs.Trigger value="metadata" className={clsx('flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold outline-none transition-all', activeTab === 'metadata' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]')}>
              <FileText size={16} /> {tf('detail.tabs.metadata')}
            </Tabs.Trigger>
            <Tabs.Trigger value="audit" className={clsx('flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold outline-none transition-all', activeTab === 'audit' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]')}>
              <History size={16} /> {tf('detail.tabs.audit')}
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
                  <dt className="text-[var(--text-tertiary)]">{tf('detail.fields.name')}</dt>
                  <dd className="flex items-center gap-2 text-right font-medium text-[var(--text-primary)]">
                    {metadata.name}
                    {canManage && (
                      <button type="button" onClick={() => setIsRenameOpen(true)} aria-label={tf('rename.title')} className="rounded p-1 hover:bg-[var(--bg-hover)]">
                        <Pencil size={14} strokeWidth={1.75} className="text-[var(--text-tertiary)]" />
                      </button>
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{tf('detail.fields.scope')}</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">{metadata.scope === 'group' ? t('detail.scopeValues.group') : t('detail.scopeValues.private')}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{tf('detail.fields.createdAt')}</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">{formatUploadedAt(metadata.created_at)}</dd>
                </div>
              </dl>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {canManage && (
                <Button type="button" variant="secondary" onClick={() => setIsShareOpen(true)}>
                  <Share2 size={16} strokeWidth={1.75} className="mr-1.5" /> {tf('share.modalTitle')}
                </Button>
              )}
              {!readOnly && (
                <Button type="button" variant="secondary" onClick={() => void handleToggleStar()} disabled={!metadata}>
                  <Star size={16} strokeWidth={1.75} className={clsx('mr-1.5', metadata?.is_starred && 'fill-[var(--accent)] text-[var(--accent)]')} />
                  {metadata?.is_starred ? t('table.unstar') : t('table.star')}
                </Button>
              )}
              {canManage && (
                <Button type="button" variant="danger" onClick={() => setIsConfirmOpen(true)} disabled={folderId === null || isLoading}>{tf('detail.delete')}</Button>
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

      {canManage && (
        <>
          <ConfirmDialog
            open={isConfirmOpen}
            title={tf('confirmDelete.title')}
            message={tf('confirmDelete.message')}
            onCancel={() => setIsConfirmOpen(false)}
            onConfirm={() => { if (!isDeleting) void handleDeleteConfirm(); }}
          />

          <NameDialog
            open={isRenameOpen}
            title={tf('rename.title')}
            label={tf('rename.label')}
            initialValue={metadata?.name ?? ''}
            submitLabel={t('rename.submit')}
            onSubmit={handleRename}
            onClose={() => setIsRenameOpen(false)}
          />

          {folderId !== null && (
            <ShareModal open={isShareOpen} kind="folder" entityId={folderId} isOwner={metadata?.is_owner ?? false} onClose={() => setIsShareOpen(false)} />
          )}
        </>
      )}
    </>
  );
}
