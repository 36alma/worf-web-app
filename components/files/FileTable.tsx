'use client';

import { cloneElement, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import clsx from 'clsx';
import { Folder, Star } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from '@/components/ui/ContextMenu';
import EntryActionsMenu, { type ActionMenuItem } from './EntryActionsMenu';
import FileTypeIcon from './FileTypeIcon';
import ThumbnailImage from './ThumbnailImage';
import { useLongPress } from './useLongPress';
import { type EntryListProps, type FsEntry, getEntryDateIso, getEntryName } from './entryTypes';
import { formatFileSize, formatMimeType, formatUploadedAt } from '@/lib/utils/formatFiles';

export default function FileTable({
  entries,
  selectedIds,
  onToggleSelect,
  onOpenFile,
  onOpenFolder,
  onToggleStar,
  getActionItems,
  selectable = true,
  starrable = true,
}: EntryListProps) {
  const t = useTranslations('files');
  const [longPressId, setLongPressId] = useState<string | null>(null);

  const columns: Column<FsEntry>[] = [
    ...(selectable ? [{
      key: 'select',
      label: '',
      render: (_value: unknown, row: FsEntry) => (
        // Wrap (not resize) the checkbox to a 44px min hit area (spec §1.1) —
        // <label> makes the whole padded area toggle the input natively.
        <label onClick={(event) => event.stopPropagation()} className="flex min-h-11 min-w-11 items-center justify-center sm:min-h-0 sm:min-w-0">
          <input
            type="checkbox"
            checked={selectedIds.has(row.id)}
            onChange={() => onToggleSelect(row)}
            aria-label={t('table.selectRow')}
            className="h-4 w-4 accent-[var(--accent)]"
          />
        </label>
      ),
    }] : []),
    {
      key: 'name',
      label: t('table.name'),
      render: (_value, row) => (
        <button
          type="button"
          onClick={() => (row.kind === 'folder' ? onOpenFolder(row.id) : onOpenFile(row.id))}
          className="flex items-center gap-2 text-left font-medium text-[var(--text-primary)] hover:underline"
        >
          {row.kind === 'folder' ? (
            <Folder size={18} strokeWidth={1.5} className="shrink-0 text-[var(--text-tertiary)]" />
          ) : row.mime_type?.startsWith('image/') ? (
            <span className="h-7 w-7 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--bg-elevated)]">
              <ThumbnailImage fileId={row.id} mimeType={row.mime_type} alt={row.original_name} className="h-full w-full object-cover" />
            </span>
          ) : (
            <FileTypeIcon mimeType={row.mime_type} size={18} className="shrink-0 text-[var(--text-tertiary)]" />
          )}
          <span className="truncate" title={getEntryName(row)}>{getEntryName(row)}</span>
        </button>
      ),
    },
    {
      key: 'type',
      label: t('table.type'),
      render: (_value, row) => (row.kind === 'folder' ? t('table.folderType') : formatMimeType(row.mime_type)),
    },
    {
      key: 'size',
      label: t('table.size'),
      render: (_value, row) => (row.kind === 'folder' ? '-' : formatFileSize(row.size_bytes)),
    },
    {
      key: 'date',
      label: t('table.uploadedAt'),
      render: (_value, row) => {
        const iso = getEntryDateIso(row);
        return iso ? formatUploadedAt(iso) : '-';
      },
    },
    ...(starrable ? [{
      key: 'star',
      label: '',
      render: (_value: unknown, row: FsEntry) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleStar(row);
          }}
          aria-label={row.is_starred ? t('table.unstar') : t('table.star')}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded p-1 hover:bg-[var(--bg-hover)] sm:min-h-0 sm:min-w-0"
        >
          <Star
            size={16}
            strokeWidth={1.75}
            className={row.is_starred ? 'fill-[var(--accent)] text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}
          />
        </button>
      ),
    }] : []),
    {
      key: 'actions',
      label: t('table.actions'),
      render: (_value, row) => (
        <EntryActionsMenu
          items={getActionItems(row)}
          triggerLabel={t('table.actions')}
          sheetTitle={t('table.actions')}
          open={longPressId === row.id}
          onOpenChange={(open) => setLongPressId(open ? row.id : null)}
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={entries}
      emptyState={<span className="text-sm text-[var(--text-tertiary)]">{t('table.emptyText')}</span>}
      rowWrapper={(row, tr) => (
        <FileTableRow row={row} tr={tr} getActionItems={getActionItems} onLongPress={() => setLongPressId(row.id)} />
      )}
    />
  );
}

function FileTableRow({
  row,
  tr,
  getActionItems,
  onLongPress,
}: {
  row: FsEntry;
  tr: ReactElement<Record<string, unknown>>;
  getActionItems: (entry: FsEntry) => ActionMenuItem[];
  onLongPress: () => void;
}) {
  const longPress = useLongPress(onLongPress);
  const items = getActionItems(row);
  const draggable = useDraggable({ id: `entry-drag:${row.id}`, data: { entry: row } });
  const droppable = useDroppable({ id: `folder-drop:${row.id}`, data: { folderId: row.id }, disabled: row.kind !== 'folder' });
  const trProps = tr.props as { className?: string };

  const draggableTr = cloneElement(tr, {
    ...longPress,
    ...draggable.listeners,
    ...draggable.attributes,
    ref: (node: HTMLTableRowElement | null) => {
      draggable.setNodeRef(node);
      droppable.setNodeRef(node);
    },
    className: clsx(
      trProps.className,
      draggable.isDragging && 'opacity-40',
      droppable.isOver && row.kind === 'folder' && 'bg-[var(--bg-active)] ring-2 ring-inset ring-[var(--accent)]'
    ),
  });

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{draggableTr}</ContextMenuTrigger>
      <ContextMenuContent>
        {items
          .filter((item) => !item.hidden)
          .map((item) => (
            <ContextMenuItem key={item.key} disabled={item.disabled} variant={item.variant === 'danger' ? 'danger' : 'default'} onSelect={item.onSelect}>
              {item.icon}
              {item.label}
            </ContextMenuItem>
          ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}
