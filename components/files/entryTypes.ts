import type { FileListItem } from '@/lib/api/files';
import type { FolderListEntry } from '@/lib/api/folders';

export type FileEntry = { kind: 'file' } & FileListItem;
export type FolderEntry = { kind: 'folder' } & FolderListEntry;
export type FsEntry = FileEntry | FolderEntry;

export const toFileEntries = (items: FileListItem[]): FileEntry[] => items.map((item) => ({ kind: 'file', ...item }));
export const toFolderEntries = (items: FolderListEntry[]): FolderEntry[] =>
  items.map((item) => ({ kind: 'folder', ...item }));

export function getEntryName(entry: FsEntry): string {
  return entry.kind === 'file' ? entry.original_name : entry.name;
}

/** ISO date string to display: uploaded_at for files, created_at for folders. */
export function getEntryDateIso(entry: FsEntry): string | null {
  return entry.kind === 'file' ? entry.uploaded_at : entry.created_at;
}

export interface EntryListProps {
  entries: FsEntry[];
  selectedIds: Set<string>;
  onToggleSelect: (entry: FsEntry) => void;
  onOpenFile: (fileId: string) => void;
  onOpenFolder: (folderId: string) => void;
  onToggleStar: (entry: FsEntry) => void;
  renderActions: (entry: FsEntry) => React.ReactNode;
}
