'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { Download, FolderPlus, Pencil, Star, Trash2 } from 'lucide-react';
import { LayoutGrid, List, Search } from 'lucide-react';
import { requestDownload, buildDownloadUrl, deleteFile, renameFile, starFile, unstarFile } from '@/lib/api/files';
import { listFolder, createFolder, deleteFolder, renameFolder, starFolder, unstarFolder } from '@/lib/api/folders';
import { translateFileApiError } from '@/lib/i18n/files';
import { translateFolderApiError } from '@/lib/i18n/folders';
import { getFileCategory, type FileCategory } from '@/lib/utils/formatFiles';
import { markForbidden, isForbidden } from '@/lib/permissions/filesGuard';
import { usePagedDualList } from '@/hooks/usePagedDualList';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import FileTable from '@/components/files/FileTable';
import FileGrid from '@/components/files/FileGrid';
import BulkActionBar from '@/components/files/BulkActionBar';
import UploadDialog from '@/components/files/UploadDialog';
import FileDetailSheet from '@/components/files/FileDetailSheet';
import FolderDetailSheet from '@/components/files/FolderDetailSheet';
import FilesBreadcrumb from '@/components/files/FilesBreadcrumb';
import NameDialog from '@/components/files/NameDialog';
import EntryActionsMenu, { type ActionMenuItem } from '@/components/files/EntryActionsMenu';
import { toFileEntries, toFolderEntries, type FsEntry } from '@/components/files/entryTypes';

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
          }]
        : []),
      {
        key: 'rename',
        label: t('table.rename'),
        icon: <Pencil size={16} strokeWidth={1.75} />,
        onSelect: () => setRenameTarget(entry),
        hidden: isForbidden(scope, 'edit', entry.id),
      },
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

      <UploadDialog open={isUploadOpen} onClose={() => setIsUploadOpen(false)} mode={mode} groupId={groupId} folderId={folderId} onUploaded={refetch} />
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
          onOpenFile={setSelectedFileId}
          onOpenFolder={setSelectedFolderDetailId}
          onToggleStar={handleToggleStar}
          renderActions={renderActions}
        />
      ) : (
        <FileTable
          entries={filteredEntries}
          selectedIds={selectedIds}
          onToggleSelect={(entry) => setSelectedIds((current) => toggleSet(current, entry.id))}
          onOpenFile={setSelectedFileId}
          onOpenFolder={setSelectedFolderDetailId}
          onToggleStar={handleToggleStar}
          renderActions={renderActions}
        />
      )}

      <BulkActionBar
        count={selectedIds.size}
        onDownloadAll={() => void handleBulkDownload()}
        onDeleteAll={() => void handleBulkDelete()}
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

      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget?.kind === 'folder' ? tf('confirmDelete.title') : t('detail.confirmDelete.title')}
        message={deleteTarget?.kind === 'folder' ? tf('confirmDelete.message') : t('detail.confirmDelete.message')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </section>
  );
}

function toggleSet(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
