'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { Star } from 'lucide-react';
import { listFiles, starFile, unstarFile, requestDownload, buildDownloadUrl, type FileListItem } from '@/lib/api/files';
import { listFolder, starFolder, unstarFolder, type FolderListEntry } from '@/lib/api/folders';
import { translateFileApiError } from '@/lib/i18n/files';
import EmptyState from '@/components/ui/EmptyState';
import FileTable from '@/components/files/FileTable';
import FileDetailSheet from '@/components/files/FileDetailSheet';
import PreviewModal from '@/components/files/PreviewModal';
import { type ActionMenuItem } from '@/components/files/EntryActionsMenu';
import { toFileEntries, toFolderEntries, type FsEntry } from '@/components/files/entryTypes';

const PAGE_SIZE = 100;
// Safety cap on how many folders we'll recurse into while walking the
// group's folder tree — the backend has no flat "all folders in a group"
// listing (unlike /v1/files/list), so this view has to walk the tree itself
// one /v1/folders/list call per folder. Bounded to keep pathological/huge
// trees from generating unbounded requests.
const MAX_FOLDERS_VISITED = 500;

export interface GroupStarredViewProps {
  groupId: string;
}

async function collectStarredFiles(groupId: string): Promise<FileListItem[]> {
  const starred: FileListItem[] = [];
  let offset = 0;
  for (;;) {
    const response = await listFiles({ scope: 'group', group_id: groupId, offset, limit: PAGE_SIZE });
    starred.push(...response.data.items.filter((item) => item.is_starred));
    offset += PAGE_SIZE;
    if (offset >= response.data.total) break;
  }
  return starred;
}

async function collectStarredFolders(groupId: string): Promise<FolderListEntry[]> {
  const starred: FolderListEntry[] = [];
  const queue: (string | null)[] = [null];
  let visited = 0;

  while (queue.length > 0 && visited < MAX_FOLDERS_VISITED) {
    const folderId = queue.shift() as string | null;
    let offset = 0;
    for (;;) {
      const response = await listFolder({ folder_id: folderId, scope: 'group', group_id: groupId, offset, limit: PAGE_SIZE });
      for (const sub of response.data.subfolders) {
        if (sub.is_starred) starred.push(sub);
        queue.push(sub.id);
        visited += 1;
      }
      offset += PAGE_SIZE;
      if (offset >= response.data.subfolder_total) break;
    }
  }
  return starred;
}

export default function GroupStarredView({ groupId }: GroupStarredViewProps) {
  const t = useTranslations('files');
  const locale = useLocale();
  const router = useRouter();

  const [files, setFiles] = useState<FileListItem[]>([]);
  const [folders, setFolders] = useState<FolderListEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const [starredFiles, starredFolders] = await Promise.all([
        collectStarredFiles(groupId),
        collectStarredFolders(groupId),
      ]);
      setFiles(starredFiles);
      setFolders(starredFolders);
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const entries = useMemo<FsEntry[]>(() => [...toFolderEntries(folders), ...toFileEntries(files)], [folders, files]);
  const fileEntries = useMemo(() => toFileEntries(files), [files]);

  const handleToggleStar = async (entry: FsEntry) => {
    try {
      if (entry.kind === 'file') await unstarFile(entry.id);
      else await unstarFolder(entry.id);
      void load();
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
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t('starred.groupTitle')}</h1>
        <EmptyState icon={<Star size={24} strokeWidth={1.5} />}>{t('starred.groupEmptyText')}</EmptyState>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t('starred.groupTitle')}</h1>
      {isLoading ? (
        <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
      ) : (
        <FileTable
          entries={entries}
          selectedIds={new Set()}
          onToggleSelect={() => undefined}
          onOpenFile={setSelectedFileId}
          onOpenFolder={(id) => router.push(`/${locale}/groups/${groupId}/files/folder/${encodeURIComponent(id)}`)}
          onToggleStar={handleToggleStar}
          getActionItems={buildActionItems}
          selectable={false}
        />
      )}
      <FileDetailSheet
        fileId={selectedFileId}
        onClose={() => setSelectedFileId(null)}
        onDeleted={() => { setSelectedFileId(null); void load(); }}
        onChanged={() => void load()}
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
