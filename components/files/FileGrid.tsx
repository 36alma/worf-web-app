'use client';

import { Folder, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import ThumbnailImage from './ThumbnailImage';
import { type EntryListProps, getEntryDateIso, getEntryName } from './entryTypes';
import { formatFileSize, formatMimeType, formatUploadedAt } from '@/lib/utils/formatFiles';

export default function FileGrid({
  entries,
  selectedIds,
  onToggleSelect,
  onOpenFile,
  onOpenFolder,
  onToggleStar,
  renderActions,
}: EntryListProps) {
  const t = useTranslations('files');

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-[var(--radius-lg)] border-[0.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-10">
        <span className="text-sm text-[var(--text-tertiary)]">{t('table.emptyText')}</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {entries.map((entry) => {
        const isSelected = selectedIds.has(entry.id);
        const dateIso = getEntryDateIso(entry);

        return (
          <div
            key={entry.id}
            role="button"
            tabIndex={0}
            onClick={() => (entry.kind === 'folder' ? onOpenFolder(entry.id) : onOpenFile(entry.id))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                entry.kind === 'folder' ? onOpenFolder(entry.id) : onOpenFile(entry.id);
              }
            }}
            className="group relative flex cursor-pointer flex-col items-start gap-2 rounded-[var(--radius-lg)] border-[0.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-left transition-colors hover:bg-[var(--bg-hover)]"
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(entry)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              aria-label={t('table.selectRow')}
              className={`absolute left-2 top-2 z-10 h-4 w-4 accent-[var(--accent)] ${
                isSelected ? '' : 'opacity-0 group-hover:opacity-100'
              }`}
            />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleStar(entry);
              }}
              onKeyDown={(event) => event.stopPropagation()}
              aria-label={entry.is_starred ? t('table.unstar') : t('table.star')}
              className="absolute right-2 top-2 z-10 rounded p-1 hover:bg-[var(--bg-active)]"
            >
              <Star
                size={14}
                strokeWidth={1.75}
                className={entry.is_starred ? 'fill-[var(--accent)] text-[var(--accent)]' : 'text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100'}
              />
            </button>

            <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded-[var(--radius-sm)] bg-[var(--bg-elevated)]">
              {entry.kind === 'folder' ? (
                <Folder size={28} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
              ) : (
                <ThumbnailImage fileId={entry.id} mimeType={entry.mime_type} alt={entry.original_name} />
              )}
            </div>

            <span className="w-full truncate text-sm font-medium text-[var(--text-primary)]" title={getEntryName(entry)}>
              {getEntryName(entry)}
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">
              {entry.kind === 'folder' ? t('table.folderType') : `${formatMimeType(entry.mime_type)} · ${formatFileSize(entry.size_bytes)}`}
            </span>
            {dateIso && <span className="text-xs text-[var(--text-tertiary)]">{formatUploadedAt(dateIso)}</span>}

            <div
              className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              {renderActions(entry)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
