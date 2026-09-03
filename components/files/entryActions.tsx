import { Download, Eye, FileText, FolderOpen, Pencil, Share2, Star, Trash2 } from 'lucide-react';
import type { ActionMenuItem } from './EntryActionsMenu';
import type { FsEntry } from './entryTypes';
import { isForbidden } from '@/lib/permissions/filesGuard';

export function isPreviewable(entry: FsEntry): boolean {
  return entry.kind === 'file' && Boolean(entry.mime_type?.startsWith('image/'));
}

export interface EntryActionsContext {
  /** Translation function scoped to the 'files' namespace (useTranslations('files') return value is a valid supertype). */
  t: (key: string) => string;
  onOpenFolder: (entry: FsEntry) => void;
  onPreview: (entry: FsEntry) => void;
  onDetails: (entry: FsEntry) => void;
  onShare: (entry: FsEntry) => void;
  onDownload: (entry: FsEntry) => void;
  onRename: (entry: FsEntry) => void;
  onToggleStar: (entry: FsEntry) => void;
  onDelete: (entry: FsEntry) => void;
}

export function buildEntryActions(entry: FsEntry, ctx: EntryActionsContext): ActionMenuItem[] {
  const scope = entry.kind === 'file' ? 'file' : 'folder';
  const items: ActionMenuItem[] = [];

  if (entry.kind === 'folder') {
    items.push({
      key: 'open',
      label: ctx.t('table.open'),
      icon: <FolderOpen size={16} strokeWidth={1.75} />,
      onSelect: () => ctx.onOpenFolder(entry),
    });
  }

  if (entry.kind === 'file' && isPreviewable(entry)) {
    items.push({
      key: 'preview',
      label: ctx.t('table.preview'),
      icon: <Eye size={16} strokeWidth={1.75} />,
      onSelect: () => ctx.onPreview(entry),
    });
  }

  items.push({
    key: 'details',
    label: ctx.t('preview.details'),
    icon: <FileText size={16} strokeWidth={1.75} />,
    onSelect: () => ctx.onDetails(entry),
  });

  if (entry.kind === 'file') {
    items.push({
      key: 'download',
      label: ctx.t('detail.download'),
      icon: <Download size={16} strokeWidth={1.75} />,
      onSelect: () => ctx.onDownload(entry),
      hidden: isForbidden(scope, 'download', entry.id),
    });
  }

  if (entry.is_owner) {
    items.push({
      key: 'share',
      label: ctx.t('share.modalTitle'),
      icon: <Share2 size={16} strokeWidth={1.75} />,
      onSelect: () => ctx.onShare(entry),
    });
  }

  items.push({
    key: 'rename',
    label: ctx.t('table.rename'),
    icon: <Pencil size={16} strokeWidth={1.75} />,
    onSelect: () => ctx.onRename(entry),
    hidden: isForbidden(scope, 'edit', entry.id),
  });

  items.push({
    key: 'star',
    label: entry.is_starred ? ctx.t('table.unstar') : ctx.t('table.star'),
    icon: <Star size={16} strokeWidth={1.75} />,
    onSelect: () => ctx.onToggleStar(entry),
  });

  items.push({
    key: 'delete',
    label: ctx.t('detail.delete'),
    icon: <Trash2 size={16} strokeWidth={1.75} />,
    variant: 'danger',
    onSelect: () => ctx.onDelete(entry),
    hidden: isForbidden(scope, 'delete', entry.id),
  });

  return items;
}
