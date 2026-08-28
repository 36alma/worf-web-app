'use client';

import { useTranslations } from 'next-intl';
import DataTable, { type Column } from '@/components/ui/DataTable';
import type { FileListItem } from '@/lib/api/files';
import { formatFileSize, formatMimeType, formatUploadedAt } from '@/lib/utils/formatFiles';

export interface FileTableProps {
  items: FileListItem[];
  /**
   * Optional row-selection callback. When provided, the "name" column
   * renders the file name as a clickable button that calls this with the
   * file's id. When omitted, the name renders as plain text.
   *
   * This is the hook Task 4 (file-detail panel) is expected to wire up:
   * pass a handler here to open the detail sheet for the clicked row.
   */
  onSelectFile?: (fileId: string) => void;
}

export default function FileTable({ items, onSelectFile }: FileTableProps) {
  const t = useTranslations('files');

  const columns: Column<FileListItem>[] = [
    {
      key: 'original_name',
      label: t('table.name'),
      render: (value, row) => {
        const name = String(value ?? '-');
        if (!onSelectFile) {
          return name;
        }
        return (
          <button
            type="button"
            onClick={() => onSelectFile(row.id)}
            className="text-left font-medium text-[var(--text-primary)] hover:underline"
          >
            {name}
          </button>
        );
      },
    },
    {
      key: 'mime_type',
      label: t('table.type'),
      render: (value) => formatMimeType(value as string | null),
    },
    {
      key: 'size_bytes',
      label: t('table.size'),
      render: (value) => formatFileSize(value as number | null),
    },
    {
      key: 'uploaded_at',
      label: t('table.uploadedAt'),
      render: (value) => formatUploadedAt(String(value)),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={items}
      emptyState={<span className="text-sm text-[var(--text-tertiary)]">{t('table.emptyText')}</span>}
    />
  );
}
