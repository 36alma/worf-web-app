'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { Copy, Download, FolderInput, FolderPlus, Info, Pencil, Share2, Star, Trash2 } from 'lucide-react';
import { LayoutGrid, List, Search } from 'lucide-react';
import { requestDownload, buildDownloadUrl, deleteFile, renameFile, starFile, unstarFile, bulkShareWithGroup, moveFile, copyFile } from '@/lib/api/files';
import { listFolder, createFolder, deleteFolder, renameFolder, starFolder, unstarFolder, moveFolder } from '@/lib/api/folders';
import { getUserGroups } from '@/lib/api/groups';
import { translateFileApiError } from '@/lib/i18n/files';
import { translateFolderApiError } from '@/lib/i18n/folders';
import { getFileCategory, type FileCategory } from '@/lib/utils/formatFiles';
import { markForbidden, isForbidden } from '@/lib/permissions/filesGuard';
import { usePagedDualList } from '@/hooks/usePagedDualList';
import { useUploadQueue } from '@/hooks/useUploadQueue';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import FileTable from '@/components/files/FileTable';
import FileGrid from '@/components/files/FileGrid';
import BulkActionBar from '@/components/files/BulkActionBar';
import UploadDialog from '@/components/files/UploadDialog';
import UploadProgressPanel from '@/components/files/UploadProgressPanel';
import FileDetailSheet from '@/components/files/FileDetailSheet';
import FolderDetailSheet from '@/components/files/FolderDetailSheet';
import PreviewModal from '@/components/files/PreviewModal';
import FilesBreadcrumb from '@/components/files/FilesBreadcrumb';
import NameDialog from '@/components/files/NameDialog';
import EntryActionsMenu, { type ActionMenuItem } from '@/components/files/EntryActionsMenu';
import ShareModal from '@/components/files/ShareModal';
import MoveToFolderDialog from '@/components/files/MoveToFolderDialog';
import { toFileEntries, toFolderEntries, type FsEntry, type FileEntry } from '@/components/files/entryTypes';

type CategoryFilter = FileCategory | 'all';
type ViewMode = 'list' | 'grid';

export interface FilesFeedProps {
  mode: 'private' | 'group';
  groupId?: string;
  folderId?: string | null;
  /** Base route for breadcrumb/folder links, e.g. "/files" or "/groups/xyz/files". */
  basePath: string;
}

const PAGE_SIZE = 20;

export default function FilesFeed({ mode, groupId, folderId = null, basePath }: FilesFeedProps) {
  const t = useTranslations('files');
  const tf = useTranslations('folders');
  const router = useRouter();
  const locale = useLocale();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [view, setView] = useState<ViewMode>('list');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkBusy, setIsBulkBusy] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FsEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FsEntry | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedFolderDetailId, setSelectedFolderDetailId] = useState<string | null>(null);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<FsEntry | null>(null);
  const [isBulkShareOpen, setIsBulkShareOpen] = useState(false);
  const [bulkShareGroups, setBulkShareGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBulkGroupId, setSelectedBulkGroupId] = useState('');
  const [isBulkSharing, setIsBulkSharing] = useState(false);
  const [moveTarget, setMoveTarget] = useState<{ entry: FsEntry; mode: 'move' | 'copy' } | null>(null);
  const [isBulkMoveOpen, setIsBulkMoveOpen] = useState(false);

  const {
    listA: subfolders,
    listB: files,
    isLoading,
    hasMore,
    loadMore,
    reset: refetch,
  } = usePagedDualList(
    async (offset, limit) => {
      try {
        const response = await listFolder({ folder_id: folderId, scope: mode, group_id: mode === 'group' ? groupId : undefined, offset, limit });
        return {
          listA: response.data.subfolders,
          listB: response.data.files,
          totalA: response.data.subfolder_total,
          totalB: response.data.file_total,
        };
      } catch (error) {
        // Report the failure to the user here, then re-throw so
        // usePagedDualList's own catch (not this fetcher) is the one that
        // decides how to handle hook state — it preserves the last known-good
        // lists/totals on a failed loadMore() instead of collapsing them to 0.
        toast.error(translateFolderApiError(tf, error, 'errors.default'));
        throw error;
      }
    },
    PAGE_SIZE,
    [mode, groupId, folderId]
  );

  const {
    items: uploadItems,
    enqueue: enqueueUploads,
    retry: retryUpload,
    removeSettled: removeSettledUpload,
  } = useUploadQueue({ mode, groupId, folderId, onAllSettled: refetch });

  const entries = useMemo<FsEntry[]>(() => [...toFolderEntries(subfolders), ...toFileEntries(files)], [subfolders, files]);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (entry.kind === 'folder') return !query || entry.name.toLowerCase().includes(query);
      if (category !== 'all' && getFileCategory(entry.mime_type) !== category) return false;
      if (query && !entry.original_name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [entries, search, category]);

  // Bulk-share's 100-item cap (spec §3.3) applies to files only, so the
  // BulkActionBar "too many" check needs the files-only subset of the
  // selection, not the raw selectedIds.size (which also counts folders).
  const selectedFileCount = useMemo(
    () => entries.filter((e) => selectedIds.has(e.id) && e.kind === 'file').length,
    [entries, selectedIds]
  );

  const handleToggleStar = async (entry: FsEntry) => {
    const originalStarred = entry.is_starred;
    // Optimistic flip (spec §3.5) — refetch() below re-syncs with the server either way.
    try {
      if (entry.kind === 'file') {
        await (originalStarred ? unstarFile(entry.id) : starFile(entry.id));
      } else {
        await (originalStarred ? unstarFolder(entry.id) : starFolder(entry.id));
      }
      refetch();
    } catch (error) {
      toast.error(entry.kind === 'file' ? translateFileApiError(t, error, 'errors.default') : translateFolderApiError(tf, error, 'errors.default'));
    }
  };

  const handleDownload = async (entry: FsEntry) => {
    if (entry.kind !== 'file') return;
    try {
      const response = await requestDownload(entry.id);
      window.location.href = buildDownloadUrl(response.data.download_token);
    } catch (error) {
      const status = (error as {response?: {status?: number}} | undefined)?.response?.status;
      if (status === 403) {
        markForbidden('file', 'download', entry.id);
      }
      toast.error(translateFileApiError(t, error, 'errors.default'));
    }
  };

  const handleRenameSubmit = async (name: string) => {
    if (!renameTarget) return;
    try {
      if (renameTarget.kind === 'file') {
        await renameFile(renameTarget.id, name);
      } else {
        await renameFolder(renameTarget.id, name);
      }
      toast.success(t('toasts.renameSuccess'));
      refetch();
    } catch (error) {
      const status = (error as {response?: {status?: number}} | undefined)?.response?.status;
      if (status === 403) {
        markForbidden(renameTarget.kind, 'edit', renameTarget.id);
      }
      toast.error(renameTarget.kind === 'file' ? translateFileApiError(t, error, 'errors.default') : translateFolderApiError(tf, error, 'errors.default'));
      throw error;
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === 'file') {
        await deleteFile(deleteTarget.id);
        toast.success(t('toasts.deleteSuccess'));
      } else {
        await deleteFolder(deleteTarget.id);
        toast.success(tf('toasts.deleteSuccess'));
      }
      setDeleteTarget(null);
      refetch();
    } catch (error) {
      const status = (error as {response?: {status?: number}} | undefined)?.response?.status;
      if (status === 403) {
        markForbidden(deleteTarget.kind, 'delete', deleteTarget.id);
      }
      toast.error(deleteTarget.kind === 'file' ? translateFileApiError(t, error, 'errors.default') : translateFolderApiError(tf, error, 'errors.default'));
    }
  };

  const handleBulkDownload = async () => {
    setIsBulkBusy(true);
    const fileIds = entries.filter((e) => e.kind === 'file' && selectedIds.has(e.id)).map((e) => e.id);
    for (const fileId of fileIds) {
      try {
        const response = await requestDownload(fileId);
        window.location.href = buildDownloadUrl(response.data.download_token);
      } catch (error) {
        toast.error(translateFileApiError(t, error, 'errors.default'));
      }
    }
    setIsBulkBusy(false);
  };

  const handleBulkDelete = async () => {
    setIsBulkBusy(true);
    const targets = entries.filter((e) => selectedIds.has(e.id));
    let succeeded = 0;
    for (const entry of targets) {
      try {
        if (entry.kind === 'file') await deleteFile(entry.id);
        else await deleteFolder(entry.id);
        succeeded += 1;
      } catch (error) {
        const status = (error as {response?: {status?: number}} | undefined)?.response?.status;
        if (status === 403) markForbidden(entry.kind, 'delete', entry.id);
        // individual failure — counted in the summary toast below
      }
    }
    toast.success(t('bulk.deleteSummary', { succeeded, total: targets.length }));
    setSelectedIds(new Set());
    setIsBulkBusy(false);
    refetch();
  };

  // Bulk move (Task 30): unlike bulk share/download, this applies to BOTH
  // files and folders in the selection (mirrors handleBulkDelete's pattern,
  // not handleBulkDownload's files-only one). excludeFolderId is left null
  // for the bulk case — it can't exclude every selected folder's subtree at
  // once, so this is best-effort UX only; the backend's own cycle-detection
  // 409 remains the real safety net for any folder moved into its own child.
  const handleBulkMoveSelect = async (targetFolderId: string | null) => {
    const targets = entries.filter((e) => selectedIds.has(e.id));
    let succeeded = 0;
    for (const entry of targets) {
      try {
        if (entry.kind === 'file') await moveFile(entry.id, targetFolderId);
        else await moveFolder(entry.id, targetFolderId);
        succeeded += 1;
      } catch (error) {
        const status = (error as {response?: {status?: number}} | undefined)?.response?.status;
        if (status === 403) markForbidden(entry.kind, 'edit', entry.id);
        // individual failure — counted in the summary toast below
      }
    }
    toast.success(t('bulk.moveSummary', { succeeded, total: targets.length }));
    setSelectedIds(new Set());
    refetch();
  };

  // Bulk group-share (spec §3.3): files only, capped at 100 by the backend
  // (BulkActionBar disables the trigger past that count). Opening the modal
  // fetches the user's groups using the same defensive multi-key response
  // parsing already established in ShareModal/ShareUserTab for this endpoint.
  const handleOpenBulkShare = () => {
    setSelectedBulkGroupId('');
    setIsBulkShareOpen(true);
    getUserGroups()
      .then((response) => {
        const source = (response as { data?: unknown }).data ?? response;
        const array = source && typeof source === 'object'
          ? (['group_users', 'groups', 'items', 'result'].map((k) => (source as Record<string, unknown>)[k]).find(Array.isArray) as unknown[] | undefined)
          : undefined;
        setBulkShareGroups((array ?? []).map((item) => {
          const row = item as Record<string, unknown>;
          return { id: String(row.group_id ?? row.id ?? ''), name: String(row.group_name ?? row.name ?? '') };
        }).filter((g) => g.id));
      })
      .catch(() => setBulkShareGroups([]));
  };

  const handleConfirmBulkShare = async () => {
    if (!selectedBulkGroupId) return;
    const fileIds = entries.filter((e) => selectedIds.has(e.id) && e.kind === 'file').map((e) => e.id);
    setIsBulkSharing(true);
    try {
      const response = await bulkShareWithGroup(fileIds, selectedBulkGroupId);
      toast.success(t('bulk.shareSummary', { succeeded: response.data.succeeded.length, total: fileIds.length }));
      if (response.data.failed.length > 0) {
        toast.error(t('bulk.shareFailedDetail', { items: response.data.failed.slice(0, 3).map((f) => f.reason).join(', ') }));
      }
      setIsBulkShareOpen(false);
      setSelectedIds(new Set());
      refetch();
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    } finally {
      setIsBulkSharing(false);
    }
  };

  const handleCreateFolder = async (name: string) => {
    try {
      await createFolder({ name, scope: mode, group_id: mode === 'group' ? groupId : undefined, parent_folder_id: folderId });
      toast.success(tf('toasts.createSuccess'));
      refetch();
    } catch (error) {
      toast.error(translateFolderApiError(tf, error, 'errors.default'));
      throw error;
    }
  };

  // Clicking a folder's name/card navigates into it (basePath + /folder/{id})
  // rather than opening the metadata sheet — see the 'details' menu item
  // below for how the sheet stays reachable.
  const handleOpenFolder = (id: string) => {
    router.push(`/${locale}${basePath}/folder/${encodeURIComponent(id)}`);
  };

  // Extension point: the Move/Copy task and the Share task each add one more
  // ActionMenuItem to this exact array (after "download", before the
  // trailing "delete" entry — delete stays last since it's the most
  // destructive/least-frequently-used action, matching spec §3.2's order).
  const buildActionItems = (entry: FsEntry): ActionMenuItem[] => {
    const scope = entry.kind === 'file' ? 'file' : 'folder';
    return [
      ...(entry.kind === 'file'
        ? [{
            key: 'download',
            label: t('detail.download'),
            icon: <Download size={16} strokeWidth={1.75} />,
            onSelect: () => void handleDownload(entry),
            hidden: isForbidden(scope, 'download', entry.id),
          },
          {
            key: 'details',
            label: t('preview.details'),
            icon: <Info size={16} strokeWidth={1.75} />,
            onSelect: () => setSelectedFileId(entry.id),
          }]
        : [{
            // Primary click now navigates into the folder instead of opening
            // this metadata sheet, so it stays reachable from the kebab menu.
            key: 'details',
            label: t('table.details'),
            icon: <Info size={16} strokeWidth={1.75} />,
            onSelect: () => setSelectedFolderDetailId(entry.id),
          }]),
      {
        key: 'rename',
        label: t('table.rename'),
        icon: <Pencil size={16} strokeWidth={1.75} />,
        onSelect: () => setRenameTarget(entry),
        hidden: isForbidden(scope, 'edit', entry.id),
      },
      {
        key: 'share',
        label: t('share.modalTitle'),
        icon: <Share2 size={16} strokeWidth={1.75} />,
        onSelect: () => setShareTarget(entry),
      },
      {
        key: 'move',
        label: t('table.move'),
        icon: <FolderInput size={16} strokeWidth={1.75} />,
        onSelect: () => setMoveTarget({ entry, mode: 'move' }),
        hidden: isForbidden(scope, 'edit', entry.id),
      },
      ...(entry.kind === 'file'
        ? [{
            key: 'copy',
            label: t('table.copy'),
            icon: <Copy size={16} strokeWidth={1.75} />,
            onSelect: () => setMoveTarget({ entry, mode: 'copy' }),
          }]
        : []),
      {
        key: 'star',
        label: entry.is_starred ? t('table.unstar') : t('table.star'),
        icon: <Star size={16} strokeWidth={1.75} />,
        onSelect: () => void handleToggleStar(entry),
      },
      {
        key: 'delete',
        label: t('detail.delete'),
        icon: <Trash2 size={16} strokeWidth={1.75} />,
        variant: 'danger',
        onSelect: () => setDeleteTarget(entry),
        hidden: isForbidden(scope, 'delete', entry.id),
      },
    ];
  };

  const renderActions = (entry: FsEntry) => (
    <EntryActionsMenu items={buildActionItems(entry)} triggerLabel={t('table.actions')} sheetTitle={t(entry.kind === 'file' ? 'table.actions' : 'table.actions')} />
  );

  const title = mode === 'group' ? t('groupPage.title') : t('page.title');

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h1>
          <FilesBreadcrumb folderId={folderId} basePath={basePath} />
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => setIsNewFolderOpen(true)}>
            <FolderPlus size={16} strokeWidth={1.75} className="mr-1.5" />
            {tf('newFolder.trigger')}
          </Button>
          <Button type="button" variant="primary" onClick={() => setIsUploadOpen(true)}>
            {t('upload.submit')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search size={15} strokeWidth={1.75} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <Input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('toolbar.searchPlaceholder')} className="pl-8" />
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={category} onValueChange={(value) => setCategory(value as CategoryFilter)}>
            <TabsList>
              <TabsTrigger value="all">{t('toolbar.filters.all')}</TabsTrigger>
              <TabsTrigger value="document">{t('toolbar.filters.documents')}</TabsTrigger>
              <TabsTrigger value="image">{t('toolbar.filters.images')}</TabsTrigger>
              <TabsTrigger value="spreadsheet">{t('toolbar.filters.spreadsheets')}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] p-1">
            <button type="button" aria-label={t('toolbar.view.list')} onClick={() => setView('list')} className={`inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] ${view === 'list' ? 'bg-[var(--bg-active)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}>
              <List size={15} strokeWidth={1.75} />
            </button>
            <button type="button" aria-label={t('toolbar.view.grid')} onClick={() => setView('grid')} className={`inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] ${view === 'grid' ? 'bg-[var(--bg-active)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}>
              <LayoutGrid size={15} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      <UploadDialog
        open={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        mode={mode}
        groupId={groupId}
        folderId={folderId}
        onUploaded={refetch}
        enqueue={enqueueUploads}
      />
      <NameDialog open={isNewFolderOpen} title={tf('newFolder.title')} label={tf('newFolder.label')} submitLabel={tf('newFolder.submit')} onSubmit={handleCreateFolder} onClose={() => setIsNewFolderOpen(false)} />
      <NameDialog
        open={renameTarget !== null}
        title={renameTarget?.kind === 'file' ? t('rename.fileTitle') : tf('rename.title')}
        label={renameTarget?.kind === 'file' ? t('rename.label') : tf('rename.label')}
        initialValue={renameTarget ? (renameTarget.kind === 'file' ? renameTarget.original_name : renameTarget.name) : ''}
        submitLabel={t('rename.submit')}
        onSubmit={handleRenameSubmit}
        onClose={() => setRenameTarget(null)}
      />

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const files = Array.from(event.dataTransfer.files);
          if (files.length > 0) enqueueUploads(files);
        }}
      >
        {isLoading && entries.length === 0 ? (
          <div className="space-y-2">
            <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
          </div>
        ) : view === 'grid' ? (
          <FileGrid
            entries={filteredEntries}
            selectedIds={selectedIds}
            onToggleSelect={(entry) => setSelectedIds((current) => toggleSet(current, entry.id))}
            onOpenFile={setPreviewFileId}
            onOpenFolder={handleOpenFolder}
            onToggleStar={handleToggleStar}
            renderActions={renderActions}
          />
        ) : (
          <FileTable
            entries={filteredEntries}
            selectedIds={selectedIds}
            onToggleSelect={(entry) => setSelectedIds((current) => toggleSet(current, entry.id))}
            onOpenFile={setPreviewFileId}
            onOpenFolder={handleOpenFolder}
            onToggleStar={handleToggleStar}
            renderActions={renderActions}
          />
        )}
      </div>

      <BulkActionBar
        count={selectedIds.size}
        shareableCount={selectedFileCount}
        onDownloadAll={() => void handleBulkDownload()}
        onDeleteAll={() => void handleBulkDelete()}
        onShareAll={handleOpenBulkShare}
        onMoveAll={() => setIsBulkMoveOpen(true)}
        onClear={() => setSelectedIds(new Set())}
        isBusy={isBulkBusy}
      />

      {!isLoading && hasMore && (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" onClick={loadMore}>
            {t('table.loadMore')}
          </Button>
        </div>
      )}

      <FileDetailSheet fileId={selectedFileId} onClose={() => setSelectedFileId(null)} onDeleted={() => { setSelectedFileId(null); refetch(); }} />
      <FolderDetailSheet folderId={selectedFolderDetailId} onClose={() => setSelectedFolderDetailId(null)} onDeleted={() => { setSelectedFolderDetailId(null); refetch(); }} onRenamed={refetch} />

      <ShareModal
        open={shareTarget !== null}
        kind={shareTarget?.kind ?? 'file'}
        entityId={shareTarget?.id ?? ''}
        isOwner={shareTarget?.is_owner ?? false}
        onClose={() => setShareTarget(null)}
      />

      <MoveToFolderDialog
        open={moveTarget !== null}
        title={moveTarget?.mode === 'copy' ? t('table.copy') : t('table.move')}
        scope={mode}
        groupId={groupId}
        excludeFolderId={moveTarget?.entry.kind === 'folder' ? moveTarget.entry.id : null}
        onSelect={async (targetFolderId) => {
          if (!moveTarget) return;
          try {
            if (moveTarget.entry.kind === 'file') {
              if (moveTarget.mode === 'copy') await copyFile(moveTarget.entry.id, targetFolderId);
              else await moveFile(moveTarget.entry.id, targetFolderId);
            } else {
              await moveFolder(moveTarget.entry.id, targetFolderId);
            }
            toast.success(t('toasts.moveSuccess'));
            refetch();
          } catch (error) {
            toast.error(moveTarget.entry.kind === 'file' ? translateFileApiError(t, error, 'errors.default') : translateFolderApiError(tf, error, 'errors.default'));
            throw error;
          }
        }}
        onClose={() => setMoveTarget(null)}
      />

      <MoveToFolderDialog
        open={isBulkMoveOpen}
        title={t('table.move')}
        scope={mode}
        groupId={groupId}
        excludeFolderId={null}
        onSelect={handleBulkMoveSelect}
        onClose={() => setIsBulkMoveOpen(false)}
      />

      <Modal open={isBulkShareOpen} title={t('bulk.share')} onClose={() => setIsBulkShareOpen(false)}>
        <div className="flex flex-col gap-4">
          <select
            value={selectedBulkGroupId}
            onChange={(event) => setSelectedBulkGroupId(event.target.value)}
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus-visible:border-border-focus"
          >
            <option value="">{t('share.selectGroupPlaceholder')}</option>
            {bulkShareGroups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
          <Button
            type="button"
            variant="primary"
            loading={isBulkSharing}
            disabled={!selectedBulkGroupId}
            onClick={() => void handleConfirmBulkShare()}
          >
            {t('share.shareButton')}
          </Button>
        </div>
      </Modal>
      <PreviewModal
        files={filteredEntries.filter((e): e is FileEntry => e.kind === 'file')}
        currentFileId={previewFileId}
        onNavigate={setPreviewFileId}
        onClose={() => setPreviewFileId(null)}
        onOpenDetails={(fileId) => { setPreviewFileId(null); setSelectedFileId(fileId); }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget?.kind === 'folder' ? tf('confirmDelete.title') : t('detail.confirmDelete.title')}
        message={deleteTarget?.kind === 'folder' ? tf('confirmDelete.message') : t('detail.confirmDelete.message')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteConfirm()}
      />

      {/* Rendered once here (not inside UploadDialog) so it persists across the
          dialog opening/closing and across drag&drop uploads that never open
          the dialog at all. */}
      <UploadProgressPanel items={uploadItems} onRetry={retryUpload} onRemove={removeSettledUpload} />
    </section>
  );
}

function toggleSet(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
