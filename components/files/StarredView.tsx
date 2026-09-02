'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { getStarred, starFile, unstarFile, requestDownload, buildDownloadUrl } from '@/lib/api/files';
import { starFolder, unstarFolder } from '@/lib/api/folders';
import { translateFileApiError } from '@/lib/i18n/files';
import { usePagedDualList } from '@/hooks/usePagedDualList';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { Star } from 'lucide-react';
import FileTable from '@/components/files/FileTable';
import FileDetailSheet from '@/components/files/FileDetailSheet';
import PreviewModal from '@/components/files/PreviewModal';
import EntryActionsMenu, { type ActionMenuItem } from '@/components/files/EntryActionsMenu';
import { toFileEntries, toFolderEntries, type FsEntry } from '@/components/files/entryTypes';

const PAGE_SIZE = 20;

export default function StarredView() {
  const t = useTranslations('files');
  const locale = useLocale();
  const router = useRouter();
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);

  const {
    listA: folders,
    listB: files,
    isLoading,
    hasMore,
    loadMore,
    reset: refetch,
  } = usePagedDualList(
    async (offset, limit) => {
      try {
        const response = await getStarred(offset, limit);
        return {
          listA: response.data.folders,
          listB: response.data.files,
          totalA: response.data.folder_total,
          totalB: response.data.file_total,
        };
      } catch (error) {
        toast.error(translateFileApiError(t, error, 'errors.default'));
        throw error;
      }
    },
    PAGE_SIZE,
    []
  );

  const entries = useMemo<FsEntry[]>(() => [...toFolderEntries(folders), ...toFileEntries(files)], [folders, files]);
  const fileEntries = useMemo(() => toFileEntries(files), [files]);

  const handleOpenFolder = (id: string, scope: 'private' | 'group') => {
    // Starred entries carry no group_id (backend limitation — the starred/list
    // endpoint doesn't return which group a group-scoped item belongs to), so
    // a group folder can't be routed to reliably from here. Only private
    // folders can be navigated into directly; browse group folders from the
    // group's own Files section instead.
    if (scope === 'private') router.push(`/${locale}/files/folder/${encodeURIComponent(id)}`);
  };

  const handleToggleStar = async (entry: FsEntry) => {
    try {
      if (entry.kind === 'file') await unstarFile(entry.id);
      else await unstarFolder(entry.id);
      refetch();
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    }
  };

  const buildActionItems = (entry: FsEntry): ActionMenuItem[] => [
    ...(entry.kind === 'file'
      ? [{
          key: 'download',
          label: t('detail.download'),
          onSelect: async () => {
            try {
              const response = await requestDownload(entry.id);
              window.location.href = buildDownloadUrl(response.data.download_token);
            } catch (error) {
              toast.error(translateFileApiError(t, error, 'errors.default'));
            }
          },
        }]
      : []),
    {
      key: 'unstar',
      label: t('table.unstar'),
      icon: <Star size={16} strokeWidth={1.75} className="fill-[var(--accent)] text-[var(--accent)]" />,
      onSelect: () => void handleToggleStar(entry),
    },
  ];

  if (!isLoading && entries.length === 0) {
    return (
      <section className="space-y-4">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t('subnav.starred')}</h1>
        <EmptyState icon={<Star size={24} strokeWidth={1.5} />}>{t('starred.emptyText')}</EmptyState>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t('subnav.starred')}</h1>
      {isLoading && entries.length === 0 ? (
        <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
      ) : (
        <FileTable
          entries={entries}
          selectedIds={new Set()}
          onToggleSelect={() => undefined}
          onOpenFile={setSelectedFileId}
          onOpenFolder={(id) => {
            const folder = folders.find((f) => f.id === id);
            if (folder) handleOpenFolder(id, folder.scope);
          }}
          onToggleStar={handleToggleStar}
          renderActions={(entry) => <EntryActionsMenu items={buildActionItems(entry)} triggerLabel={t('table.actions')} sheetTitle={t('table.actions')} />}
          selectable={false}
        />
      )}
      {!isLoading && hasMore && (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" onClick={loadMore}>{t('table.loadMore')}</Button>
        </div>
      )}
      <FileDetailSheet
        fileId={selectedFileId}
        onClose={() => setSelectedFileId(null)}
        onDeleted={() => { setSelectedFileId(null); refetch(); }}
        onChanged={refetch}
        onPreview={setPreviewFileId}
      />
      <PreviewModal
        files={fileEntries}
        currentFileId={previewFileId}
        onNavigate={setPreviewFileId}
        onClose={() => setPreviewFileId(null)}
        onOpenDetails={(fileId) => { setPreviewFileId(null); setSelectedFileId(fileId); }}
      />
    </section>
  );
}
