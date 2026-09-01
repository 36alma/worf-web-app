'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { Folder } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { listFolder, type FolderListEntry } from '@/lib/api/folders';
import { translateFolderApiError } from '@/lib/i18n/folders';
import type { FileScope } from '@/lib/api/files';

export interface MoveToFolderDialogProps {
  open: boolean;
  title: string;
  scope: FileScope;
  groupId?: string;
  /** The folder being moved (if a folder) — its own subtree is skipped client-side. */
  excludeFolderId?: string | null;
  onSelect: (targetFolderId: string | null) => Promise<void>;
  onClose: () => void;
}

/**
 * One entry in the navigation history: `id: null` represents the root. We
 * track the full stack (not just the current folder id) so that:
 *  - the "current folder" label can show the folder's display NAME instead
 *    of its raw id (we already have the name from the row that was clicked
 *    to get here — no extra metadata fetch needed), and
 *  - the "Up" button can pop back exactly one level instead of always
 *    jumping to root.
 */
interface FolderStackEntry {
  id: string | null;
  name: string;
}

export default function MoveToFolderDialog({ open, title, scope, groupId, excludeFolderId, onSelect, onClose }: MoveToFolderDialogProps) {
  const t = useTranslations('files');
  const tf = useTranslations('folders');
  const [folderStack, setFolderStack] = useState<FolderStackEntry[]>([{ id: null, name: tf('moveDialog.root') }]);
  const [subfolders, setSubfolders] = useState<FolderListEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentFolder = folderStack[folderStack.length - 1];
  const currentFolderId = currentFolder.id;

  useEffect(() => {
    if (!open) return;
    setFolderStack([{ id: null, name: tf('moveDialog.root') }]);
  }, [open, tf]);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    listFolder({ folder_id: currentFolderId, scope, group_id: scope === 'group' ? groupId : undefined, limit: 100 })
      .then((response) => setSubfolders(response.data.subfolders.filter((f) => f.id !== excludeFolderId)))
      .catch((error) => toast.error(translateFolderApiError(tf, error, 'errors.default')))
      .finally(() => setIsLoading(false));
  }, [open, currentFolderId, scope, groupId, excludeFolderId, tf]);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onSelect(currentFolderId);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUp = () => {
    setFolderStack((stack) => (stack.length > 1 ? stack.slice(0, -1) : stack));
  };

  const handleOpenSubfolder = (folder: FolderListEntry) => {
    setFolderStack((stack) => [...stack, { id: folder.id, name: folder.name }]);
  };

  return (
    <Modal open={open} title={title} onClose={() => (isSubmitting ? undefined : onClose())}>
      <div className="space-y-3">
        <p className="text-xs text-[var(--text-tertiary)]">{tf('moveDialog.currentLabel', { name: currentFolder.name })}</p>
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-[var(--border-subtle)] p-2">
          {folderStack.length > 1 && (
            <button type="button" onClick={handleUp} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
              .. {tf('moveDialog.up')}
            </button>
          )}
          {isLoading ? (
            <div className="h-8 w-full animate-pulse rounded bg-[var(--bg-elevated)]" />
          ) : subfolders.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-[var(--text-tertiary)]">{tf('moveDialog.noSubfolders')}</p>
          ) : (
            subfolders.map((folder) => (
              <button key={folder.id} type="button" onClick={() => handleOpenSubfolder(folder)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)]">
                <Folder size={16} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
                {folder.name}
              </button>
            ))
          )}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>{t('upload.cancel')}</Button>
          <Button type="button" variant="primary" loading={isSubmitting} onClick={() => void handleConfirm()}>{tf('moveDialog.confirm')}</Button>
        </div>
      </div>
    </Modal>
  );
}
