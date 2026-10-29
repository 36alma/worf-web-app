'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { File, Folder, FolderPlus, FolderUp, FileUp, Plus, Star } from 'lucide-react';
import { LayoutGrid, List, Search } from 'lucide-react';
import { listFiles, getStorageUsage, requestDownload, buildDownloadUrl, deleteFile, renameFile, starFile, unstarFile, moveFile, type FileListItem } from '@/lib/api/files';
import { listFolder, createFolder, deleteFolder, renameFolder, starFolder, unstarFolder, moveFolder } from '@/lib/api/folders';
import { translateFileApiError } from '@/lib/i18n/files';
import { translateFolderApiError } from '@/lib/i18n/folders';
import { getFileCategory, formatFileSize, type FileCategory } from '@/lib/utils/formatFiles';
import { fromDataTransfer, fromFileList, summarizePending, type PendingUpload, type PendingUploadSummary } from '@/lib/utils/uploadTree';
import { markForbidden, isForbidden } from '@/lib/permissions/filesGuard';
import { usePagedDualList } from '@/hooks/usePagedDualList';
import { useUploadQueue } from '@/hooks/useUploadQueue';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import Button from '@/components/ui/Button';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from '@/components/ui/ContextMenu';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import FileTable from '@/components/files/FileTable';
import FileGrid from '@/components/files/FileGrid';
import BulkActionBar from '@/components/files/BulkActionBar';
import UploadDialog, { validateAndEnqueueFiles } from '@/components/files/UploadDialog';
import UploadProgressPanel from '@/components/files/UploadProgressPanel';
import FileDetailSheet from '@/components/files/FileDetailSheet';
import FolderDetailSheet from '@/components/files/FolderDetailSheet';
import PreviewModal from '@/components/files/PreviewModal';
import FilesBreadcrumb from '@/components/files/FilesBreadcrumb';
import NameDialog from '@/components/files/NameDialog';
import StorageUsageBar from '@/components/files/StorageUsageBar';
import ShareModal from '@/components/files/ShareModal';
import BulkShareDialog from '@/components/files/BulkShareDialog';
import MoveToFolderDialog from '@/components/files/MoveToFolderDialog';
import { buildEntryActions, isPreviewable } from '@/components/files/entryActions';
import { getEntryName, toFileEntries, toFolderEntries, type FileEntry, type FsEntry } from '@/components/files/entryTypes';

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
  const tv = useTranslations('validation');
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
  const [activeDragEntry, setActiveDragEntry] = useState<FsEntry | null>(null);
  const [isBulkMoveOpen, setIsBulkMoveOpen] = useState(false);
  const [isBulkShareOpen, setIsBulkShareOpen] = useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isBulkBusy, setIsBulkBusy] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<{ pending: PendingUpload[]; summary: PendingUploadSummary; freeBytes: number | null } | null>(null);
  const dragDepth = useRef(0);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

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

  const moveEntries = async (items: FsEntry[], targetFolderId: string | null) => {
    const results = await Promise.allSettled(
      items.map((item) => (item.kind === 'file' ? moveFile(item.id, targetFolderId) : moveFolder(item.id, targetFolderId)))
    );
    const succeeded = results.filter((result) => result.status === 'fulfilled').length;
    const summary = t('bulk.moveSummary', { succeeded, total: results.length });
    if (succeeded === results.length) toast.success(summary);
    else toast.error(summary);
    refetch();
    setSelectedIds(new Set());
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragEntry((event.active.data.current as { entry?: FsEntry } | undefined)?.entry ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const draggedEntry = (active.data.current as { entry?: FsEntry } | undefined)?.entry;
    setActiveDragEntry(null);
    if (!over || !draggedEntry) return;
    const targetFolderId = (over.data.current as { folderId?: string | null } | undefined)?.folderId;
    if (targetFolderId === undefined) return;
    if (draggedEntry.kind === 'folder' && draggedEntry.id === targetFolderId) return;
    const items = selectedIds.has(draggedEntry.id) && selectedIds.size > 1
      ? entries.filter((entry) => selectedIds.has(entry.id))
      : [draggedEntry];
    void moveEntries(items, targetFolderId);
  };

  const selectedEntries = useMemo(() => entries.filter((entry) => selectedIds.has(entry.id)), [entries, selectedIds]);
  const selectedFileEntries = useMemo(() => selectedEntries.filter((entry): entry is FileEntry => entry.kind === 'file'), [selectedEntries]);

  const handleBulkDownload = async () => {
    setIsBulkBusy(true);
    try {
      await Promise.allSettled(selectedFileEntries.map((entry) => handleDownload(entry)));
    } finally {
      setIsBulkBusy(false);
    }
  };

  const handleBulkDeleteConfirm = async () => {
    setIsBulkBusy(true);
    try {
      const results = await Promise.allSettled(
        selectedEntries.map((entry) => (entry.kind === 'file' ? deleteFile(entry.id) : deleteFolder(entry.id)))
      );
      const succeeded = results.filter((result) => result.status === 'fulfilled').length;
      const summary = t('bulk.deleteSummary', { succeeded, total: results.length });
      if (succeeded === results.length) toast.success(summary);
      else toast.error(summary);
      setIsBulkDeleteConfirmOpen(false);
      setSelectedIds(new Set());
      refreshFilesAndStorage();
    } finally {
      setIsBulkBusy(false);
    }
  };

  const handleBulkMove = async (targetFolderId: string | null) => {
    await moveEntries(selectedEntries, targetFolderId);
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

  const folderInputRef = useRef<HTMLInputElement>(null);

  // Recreates the directory tree of `pending` under the current folder, then
  // queues each file into its matching folder. Folders are created parent-first
  // and cached by relative path so shared ancestors are only created once.
  const uploadPending = async (pending: PendingUpload[]) => {
    const folderIds = new Map<string, string | null>([['', folderId]]);
    try {
      for (const { file, dir } of pending) {
        let path = '';
        for (const part of dir) {
          const parentPath = path;
          path = path ? `${path}/${part}` : part;
          if (folderIds.has(path)) continue;
          const created = await createFolder({ name: part, scope: mode, group_id: mode === 'group' ? groupId : undefined, parent_folder_id: folderIds.get(parentPath) });
          folderIds.set(path, created.data.folder_id);
        }
        validateAndEnqueueFiles(
          [file],
          (files) => uploadQueue.enqueue(files, folderIds.get(path), dir[0]),
          (suggestion) => toast(t('nameDialog.sanitizeSuggestion', { suggestion })),
          (issueMessage) => toast.error(tv(issueMessage as never))
        );
      }
    } catch (error) {
      toast.error(translateFolderApiError(tf, error, 'errors.default'));
    }
    refetch();
  };

  // Folder uploads can be large, so they get a confirmation step showing
  // what will be created and how it compares to the free storage.
  const requestUpload = (pending: PendingUpload[]) => {
    if (pending.length === 0) return;
    if (!pending.some((item) => item.dir.length > 0)) {
      void uploadPending(pending);
      return;
    }
    setUploadPreview({ pending, summary: summarizePending(pending), freeBytes: null });
    getStorageUsage(mode, mode === 'group' ? groupId : undefined)
      .then((response) => {
        const { used_bytes, limit_bytes } = response.data;
        if (limit_bytes == null) return;
        setUploadPreview((current) => (current ? { ...current, freeBytes: Math.max(limit_bytes - used_bytes, 0) } : current));
      })
      .catch(() => undefined);
  };

  const handleFolderPicked = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';
    requestUpload(fromFileList(picked));
  };

  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes('Files');

  const handlePageDragEnter = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setIsDraggingFiles(true);
  };

  const handlePageDragOver = (event: DragEvent) => {
    if (hasFiles(event)) event.preventDefault();
  };

  const handlePageDragLeave = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDraggingFiles(false);
    }
  };

  const handlePageDrop = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    dragDepth.current = 0;
    setIsDraggingFiles(false);
    // The dropzone inside the upload dialog handles its own drops; its event
    // bubbles here through the React tree, so don't enqueue those twice.
    if (event.defaultPrevented) return;
    event.preventDefault();
    void fromDataTransfer(event.dataTransfer).then(requestUpload);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (document.querySelector('[role="dialog"],[role="alertdialog"],[role="menu"]')) return;
      const key = event.key.toLowerCase();
      if (key === 'n' && event.shiftKey) {
        event.preventDefault();
        setIsNewFolderOpen(true);
      } else if (key === 'u') {
        event.preventDefault();
        if (event.shiftKey) folderInputRef.current?.click();
        else setIsUploadOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    <DndContext sensors={dndSensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <section className="space-y-4" onDragEnter={handlePageDragEnter} onDragOver={handlePageDragOver} onDragLeave={handlePageDragLeave} onDrop={handlePageDrop}>
      {isDraggingFiles && (
        <div className="pointer-events-none fixed inset-0 z-[55] flex items-center justify-center bg-black/40 p-6">
          <div className="flex items-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--accent)] bg-[var(--bg-elevated)] px-8 py-10 text-[var(--text-primary)]">
            <FileUp size={20} strokeWidth={1.75} />
            {t('newMenu.dropHint')}
          </div>
        </div>
      )}
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
          <input
            ref={folderInputRef}
            type="file"
            multiple
            // webkitdirectory isn't in React's typings; it makes the picker select a whole folder.
            {...({ webkitdirectory: '' } as Record<string, string>)}
            onChange={handleFolderPicked}
            className="hidden"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="primary">
                <Plus size={16} strokeWidth={1.75} className="mr-1.5" />
                {t('newMenu.trigger')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setIsNewFolderOpen(true)}>
                <FolderPlus size={16} strokeWidth={1.75} />
                {t('newMenu.newFolder')}
                <span className="ml-auto pl-6 text-xs text-[var(--text-tertiary)]">Shift+N</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setIsUploadOpen(true)}>
                <FileUp size={16} strokeWidth={1.75} />
                {t('newMenu.uploadFile')}
                <span className="ml-auto pl-6 text-xs text-[var(--text-tertiary)]">U</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => folderInputRef.current?.click()}>
                <FolderUp size={16} strokeWidth={1.75} />
                {t('newMenu.uploadFolder')}
                <span className="ml-auto pl-6 text-xs text-[var(--text-tertiary)]">Shift+U</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

      <UploadDialog
        open={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        enqueue={uploadQueue.enqueue}
        items={uploadQueue.items}
        onRetry={uploadQueue.retry}
        onRemove={uploadQueue.removeSettled}
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
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="min-h-[12rem]" />
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => setIsNewFolderOpen(true)}>
            <FolderPlus size={16} strokeWidth={1.75} />
            {t('newMenu.newFolder')}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => setIsUploadOpen(true)}>
            <FileUp size={16} strokeWidth={1.75} />
            {t('newMenu.uploadFile')}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => folderInputRef.current?.click()}>
            <FolderUp size={16} strokeWidth={1.75} />
            {t('newMenu.uploadFolder')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <ConfirmDialog
        open={uploadPreview !== null}
        title={t('newMenu.previewTitle')}
        message={
          uploadPreview
            ? t('newMenu.previewMessage', { files: uploadPreview.summary.fileCount, folders: uploadPreview.summary.folderCount, size: formatFileSize(uploadPreview.summary.totalBytes) }) +
              (uploadPreview.freeBytes === null
                ? ''
                : t(uploadPreview.summary.totalBytes > uploadPreview.freeBytes ? 'newMenu.previewOverQuota' : 'newMenu.previewQuota', { free: formatFileSize(uploadPreview.freeBytes) }))
            : ''
        }
        confirmLabel={t('newMenu.previewConfirm')}
        onCancel={() => setUploadPreview(null)}
        onConfirm={() => {
          const pending = uploadPreview?.pending;
          setUploadPreview(null);
          if (pending) void uploadPending(pending);
        }}
      />
      <UploadProgressPanel items={uploadQueue.items} onRetry={uploadQueue.retry} onRemove={uploadQueue.removeSettled} />

      <BulkActionBar
        count={selectedIds.size}
        shareableCount={selectedFileEntries.length}
        onDownloadAll={() => void handleBulkDownload()}
        onDeleteAll={() => setIsBulkDeleteConfirmOpen(true)}
        onShareAll={() => setIsBulkShareOpen(true)}
        onMoveAll={() => setIsBulkMoveOpen(true)}
        onClear={() => setSelectedIds(new Set())}
        isBusy={isBulkBusy}
      />
      <MoveToFolderDialog
        open={isBulkMoveOpen}
        title={t('bulk.move')}
        scope={mode}
        groupId={groupId}
        onSelect={handleBulkMove}
        onClose={() => setIsBulkMoveOpen(false)}
      />
      <BulkShareDialog
        open={isBulkShareOpen}
        fileIds={selectedFileEntries.map((entry) => entry.id)}
        onClose={() => setIsBulkShareOpen(false)}
        onShared={() => setSelectedIds(new Set())}
      />
      <ConfirmDialog
        open={isBulkDeleteConfirmOpen}
        title={t('bulk.confirmDeleteTitle')}
        message={t('bulk.confirmDeleteMessage', { count: selectedIds.size })}
        onCancel={() => setIsBulkDeleteConfirmOpen(false)}
        onConfirm={() => void handleBulkDeleteConfirm()}
      />
    </section>
    <DragOverlay>
      {activeDragEntry && (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-lg">
          {activeDragEntry.kind === 'folder' ? (
            <Folder size={16} strokeWidth={1.75} className="text-[var(--text-tertiary)]" />
          ) : (
            <File size={16} strokeWidth={1.75} className="text-[var(--text-tertiary)]" />
          )}
          <span className="max-w-[16rem] truncate">{getEntryName(activeDragEntry)}</span>
        </div>
      )}
    </DragOverlay>
    </DndContext>
  );
}

function toggleSet(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
