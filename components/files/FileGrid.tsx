'use client';

import { useTranslations } from 'next-intl';
import type { FileListItem } from '@/lib/api/files';
import { formatFileSize, formatMimeType, formatUploadedAt } from '@/lib/utils/formatFiles';
import FileTypeIcon from './FileTypeIcon';

export interface FileGridProps {
  items: FileListItem[];
  onSelectFile?: (fileId: string) => void;
}

export default function FileGrid({ items, onSelectFile }: FileGridProps) {
  const t = useTranslations('files');

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-[var(--radius-lg)] border-[0.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-10">
        <span className="text-sm text-[var(--text-tertiary)]">{t('table.emptyText')}</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((item) => {
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectFile?.(item.id)}
            className="flex flex-col items-start gap-2 rounded-[var(--radius-lg)] border-[0.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-left transition-colors hover:bg-[var(--bg-hover)]"
          >
            <div className="flex h-16 w-full items-center justify-center rounded-[var(--radius-sm)] bg-[var(--bg-elevated)]">
              <FileTypeIcon mimeType={item.mime_type} />
            </div>
            <span className="w-full truncate text-sm font-medium text-[var(--text-primary)]" title={item.original_name}>
              {item.original_name}
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">
              {formatMimeType(item.mime_type)} · {formatFileSize(item.size_bytes)}
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">{formatUploadedAt(item.uploaded_at)}</span>
          </button>
        );
      })}
    </div>
  );
}
