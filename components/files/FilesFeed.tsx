'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { FolderPlus, Star } from 'lucide-react';
import { LayoutGrid, List, Search } from 'lucide-react';
import { listFiles, requestDownload, buildDownloadUrl, deleteFile, renameFile, starFile, unstarFile, type FileListItem } from '@/lib/api/files';
import { listFolder, createFolder, deleteFolder, renameFolder, starFolder, unstarFolder } from '@/lib/api/folders';
import { translateFileApiError } from '@/lib/i18n/files';
import { translateFolderApiError } from '@/lib/i18n/folders';
import { getFileCategory, type FileCategory } from '@/lib/utils/formatFiles';
import { markForbidden, isForbidden } from '@/lib/permissions/filesGuard';
import { usePagedDualList } from '@/hooks/usePagedDualList';
import { useUploadQueue } from '@/hooks/useUploadQueue';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
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
import StorageUsageBar from '@/components/files/StorageUsageBar';
import ShareModal from '@/components/files/ShareModal';
import { buildEntryActions, isPreviewable } from '@/components/files/entryActions';
import { toFileEntries, toFolderEntries, type FsEntry } from '@/components/files/entryTypes';

type CategoryFilter = FileCategory | 'all';
type ViewMode = 'list' | 'grid';

const VIEW_MODE_STORAGE_KEY = 'worf-files-view';

/** Narrows an arbitrary localStorage value to a valid ViewMode, defaulting to 'list'. */
function toViewMode(value: string | null): ViewMode {
  return value === 'grid' ? 'grid' : 'list';
}

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
  const locale = useLocale();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  // Initialized to the server-safe fallback ('list') unconditionally — reading
  // localStorage inside the useState initializer would run on both server and
  // client, and for any user whose stored preference differs from 'list' the
  // client's first render would diverge from the server-rendered HTML,
  // producing a hydration mismatch. The real value is applied client-only,
  // post-mount, below.
  const [view, setView] = useState<ViewMode>('list');
  const isMobile = useMediaQuery('(max-width: 767px)');
  const effectiveView: ViewMode = isMobile ? 'grid' : view;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FsEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FsEntry | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<FsEntry | null>(null);
  const [storageRefreshKey, setStorageRefreshKey] = useState(0);

  const {
    listA: subfolders,
    listB: files,
    totalA: subfolderTotal,
    totalB: fileTotal,
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
        toast.error(translateFolderApiError(tf, error, 'errors.default'));
        return { listA: [], listB: [], totalA: 0, totalB: 0 };
      }
    },
    PAGE_SIZE,
    [mode, groupId, folderId]
  );

  const entries = useMemo<FsEntry[]>(() => [...toFolderEntries(subfolders), ...toFileEntries(files)], [subfolders, files]);
  const fileEntries = useMemo(() => toFileEntries(files), [files]);

  const handleOpenFolder = (id: string) => {
    router.push(`/${locale}${basePath}/folder/${encodeURIComponent(id)}`);
  };

  const handleOpenFile = (fileId: string) => {
    const entry = fileEntries.find((file) => file.id === fileId);
    if (entry && isPreviewable(entry)) {
      setPreviewFileId(fileId);
    } else {
      setSelectedFileId(fileId);
    }
  };

  const refreshFilesAndStorage = () => {
    setStorageRefreshKey((current) => current + 1);
    refetch();
  };

  const uploadQueue = useUploadQueue({
    mode,
    groupId,
    folderId,
    onAllSettled: refreshFilesAndStorage,
  });

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
      refreshFilesAndStorage();
    } catch (error) {
      toast.error(deleteTarget.kind === 'file' ? translateFileApiError(t, error, 'errors.default') : translateFolderApiError(tf, error, 'errors.default'));
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

  const getActionItems = (entry: FsEntry) =>
    buildEntryActions(entry, {
      // next-intl's Translator type restricts `key` to known message paths,
      // which is narrower than EntryActionsContext's `(key: string) => string`;
      // this wrapper widens the parameter type back to plain string without
      // touching entryActions.tsx's contract.
      t: (key: string) => t(key as Parameters<typeof t>[0]),
      onOpenFolder: (target) => handleOpenFolder(target.id),
      onPreview: (target) => setPreviewFileId(target.id),
      onDetails: (target) => (target.kind === 'folder' ? setSelectedFolderId(target.id) : setSelectedFileId(target.id)),
      onShare: (target) => setShareTarget(target),
      onDownload: (target) => void handleDownload(target),
      onRename: (target) => setRenameTarget(target),
      onToggleStar: (target) => void handleToggleStar(target),
      onDelete: (target) => setDeleteTarget(target),
    });

  const title = mode === 'group' ? t('groupPage.title') : t('page.title');

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h1>
          <FilesBreadcrumb folderId={folderId} basePath={basePath} />
        </div>
        <div className="flex items-center gap-2">
          {mode === 'group' && (
            <Button type="button" variant="secondary" onClick={() => router.push(`/${locale}${basePath}/starred`)}>
              <Star size={16} strokeWidth={1.75} className="mr-1.5" />
              {t('subnav.starred')}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={() => setIsNewFolderOpen(true)}>
            <FolderPlus size={16} strokeWidth={1.75} className="mr-1.5" />
            {tf('newFolder.trigger')}
          </Button>
          <Button type="button" variant="primary" onClick={() => setIsUploadOpen(true)}>
            {t('upload.submit')}
          </Button>
        </div>
      </div>

      <div className="max-w-xs">
        <StorageUsageBar scope={mode} groupId={groupId} refreshKey={storageRefreshKey} />
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
          {!isMobile && (
            <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] p-1">
              <button type="button" aria-label={t('toolbar.view.list')} onClick={() => setView('list')} className={`inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] ${effectiveView === 'list' ? 'bg-[var(--bg-active)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}>
                <List size={15} strokeWidth={1.75} />
              </button>
              <button type="button" aria-label={t('toolbar.view.grid')} onClick={() => setView('grid')} className={`inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] ${effectiveView === 'grid' ? 'bg-[var(--bg-active)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}>
                <LayoutGrid size={15} strokeWidth={1.75} />
              </button>
            </div>
          )}
        </div>
      </div>

      <UploadDialog open={isUploadOpen} onClose={() => setIsUploadOpen(false)} enqueue={uploadQueue.enqueue} />
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
      ) : effectiveView === 'grid' ? (
        <FileGrid
          entries={filteredEntries}
          selectedIds={selectedIds}
          onToggleSelect={(entry) => setSelectedIds((current) => toggleSet(current, entry.id))}
          onOpenFile={handleOpenFile}
          onOpenFolder={handleOpenFolder}
          onToggleStar={handleToggleStar}
          getActionItems={getActionItems}
        />
      ) : (
        <FileTable
          entries={filteredEntries}
          selectedIds={selectedIds}
          onToggleSelect={(entry) => setSelectedIds((current) => toggleSet(current, entry.id))}
          onOpenFile={handleOpenFile}
          onOpenFolder={handleOpenFolder}
          onToggleStar={handleToggleStar}
          getActionItems={getActionItems}
        />
      )}

      {!isLoading && hasMore && (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" onClick={loadMore}>
            {t('table.loadMore')}
          </Button>
        </div>
      )}

      <FileDetailSheet
        fileId={selectedFileId}
        onClose={() => setSelectedFileId(null)}
        onDeleted={() => { setSelectedFileId(null); refreshFilesAndStorage(); }}
        onChanged={refetch}
        onPreview={setPreviewFileId}
      />
      <FolderDetailSheet
        folderId={selectedFolderId}
        onClose={() => setSelectedFolderId(null)}
        onDeleted={() => { setSelectedFolderId(null); refreshFilesAndStorage(); }}
        onChanged={refetch}
      />
      <PreviewModal
        files={fileEntries}
        currentFileId={previewFileId}
        onNavigate={setPreviewFileId}
        onClose={() => setPreviewFileId(null)}
        onOpenDetails={(fileId) => { setPreviewFileId(null); setSelectedFileId(fileId); }}
      />

      {shareTarget && (
        <ShareModal
          open={shareTarget !== null}
          kind={shareTarget.kind}
          entityId={shareTarget.id}
          isOwner={shareTarget.is_owner}
          onClose={() => setShareTarget(null)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget?.kind === 'folder' ? tf('confirmDelete.title') : t('detail.confirmDelete.title')}
        message={deleteTarget?.kind === 'folder' ? tf('confirmDelete.message') : t('detail.confirmDelete.message')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteConfirm()}
      />
      <UploadProgressPanel items={uploadQueue.items} onRetry={uploadQueue.retry} onRemove={uploadQueue.removeSettled} />
    </section>
  );
}

function toggleSet(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
