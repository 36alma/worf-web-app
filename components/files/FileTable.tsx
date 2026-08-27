'use client';

import { useTranslations } from 'next-intl';
import DataTable, { type Column } from '@/components/ui/DataTable';
import type { FileListItem } from '@/lib/api/files';

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

/** Format a byte count as a short human-readable size string, e.g. "1.2 MB". */
function formatFileSize(bytes: number | null): string {
  if (bytes === null || Number.isNaN(bytes)) {
    return '-';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

/** Shorten a MIME type to a friendly label, falling back to the raw string. */
function formatMimeType(mimeType: string | null): string {
  if (!mimeType) {
    return '-';
  }
  const knownLabels: Record<string, string> = {
    'application/pdf': 'PDF',
    'image/png': 'PNG',
    'image/jpeg': 'JPEG',
    'image/gif': 'GIF',
    'image/webp': 'WEBP',
    'image/svg+xml': 'SVG',
    'text/plain': 'TXT',
    'text/csv': 'CSV',
    'application/zip': 'ZIP',
    'application/json': 'JSON',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.ms-excel': 'XLS',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  };
  if (knownLabels[mimeType]) {
    return knownLabels[mimeType];
  }
  if (mimeType.startsWith('image/')) {
    return mimeType.slice('image/'.length).toUpperCase();
  }
  return mimeType;
}

function formatUploadedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
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
