'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { Users } from 'lucide-react';
import { getSharedWithMe, requestDownload, buildDownloadUrl } from '@/lib/api/files';
import { translateFileApiError } from '@/lib/i18n/files';
import { usePagedDualList } from '@/hooks/usePagedDualList';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import FileTable from '@/components/files/FileTable';
import FileDetailSheet from '@/components/files/FileDetailSheet';
import FolderDetailSheet from '@/components/files/FolderDetailSheet';
import { type ActionMenuItem } from '@/components/files/EntryActionsMenu';
import { toFileEntries, toFolderEntries, type FsEntry } from '@/components/files/entryTypes';

const PAGE_SIZE = 20;

export default function SharedWithMeView() {
  const t = useTranslations('files');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const {
    listA: folders,
    listB: files,
    isLoading,
    hasMore,
    loadMore,
  } = usePagedDualList(
    async (offset, limit) => {
      try {
        const response = await getSharedWithMe(offset, limit);
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

  const buildActionItems = (entry: FsEntry): ActionMenuItem[] =>
    entry.kind === 'file'
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
      : [];

  if (!isLoading && entries.length === 0) {
    return (
      <section className="space-y-4">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t('subnav.sharedWithMe')}</h1>
        <EmptyState icon={<Users size={24} strokeWidth={1.5} />}>{t('sharedWithMe.emptyText')}</EmptyState>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t('subnav.sharedWithMe')}</h1>
      {isLoading && entries.length === 0 ? (
        <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
      ) : (
        <FileTable
          entries={entries}
          selectedIds={new Set()}
          onToggleSelect={() => undefined}
          onOpenFile={setSelectedFileId}
          onOpenFolder={setSelectedFolderId}
          onToggleStar={() => undefined}
          getActionItems={buildActionItems}
          selectable={false}
          starrable={false}
        />
      )}
      {!isLoading && hasMore && (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" onClick={loadMore}>{t('table.loadMore')}</Button>
        </div>
      )}
      <FileDetailSheet fileId={selectedFileId} onClose={() => setSelectedFileId(null)} readOnly />
      <FolderDetailSheet folderId={selectedFolderId} onClose={() => setSelectedFolderId(null)} readOnly />
    </section>
  );
}
