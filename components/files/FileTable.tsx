'use client';

import { useTranslations } from 'next-intl';
import { Folder, Star } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import FileTypeIcon from './FileTypeIcon';
import { type EntryListProps, type FsEntry, getEntryDateIso, getEntryName } from './entryTypes';
import { formatFileSize, formatMimeType, formatUploadedAt } from '@/lib/utils/formatFiles';

export default function FileTable({
  entries,
  selectedIds,
  onToggleSelect,
  onOpenFile,
  onOpenFolder,
  onToggleStar,
  renderActions,
}: EntryListProps) {
  const t = useTranslations('files');

  const columns: Column<FsEntry>[] = [
    {
      key: 'select',
      label: '',
      render: (_value, row) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.id)}
          onChange={() => onToggleSelect(row)}
          onClick={(event) => event.stopPropagation()}
          aria-label={t('table.selectRow')}
          className="h-4 w-4 accent-[var(--accent)]"
        />
      ),
    },
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
    {
      key: 'star',
      label: '',
      render: (_value, row) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleStar(row);
          }}
          aria-label={row.is_starred ? t('table.unstar') : t('table.star')}
          className="rounded p-1 hover:bg-[var(--bg-hover)]"
        >
          <Star
            size={16}
            strokeWidth={1.75}
            className={row.is_starred ? 'fill-[var(--accent)] text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}
          />
        </button>
      ),
    },
    {
      key: 'actions',
      label: t('table.actions'),
      render: (_value, row) => renderActions(row),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={entries}
      emptyState={<span className="text-sm text-[var(--text-tertiary)]">{t('table.emptyText')}</span>}
    />
  );
}
