'use client';

import { useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle2, RotateCcw, X } from 'lucide-react';
import type { UploadItem } from '@/hooks/useUploadQueue';
import UploadProgressBar from './UploadProgressBar';

export interface UploadItemRowProps {
  item: UploadItem;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

/** One row of upload-queue feedback (filename, progress bar, status icon, retry/dismiss) — shared by the in-dialog list and the floating post-close panel so both show identical state. */
export default function UploadItemRow({ item, onRetry, onRemove }: UploadItemRowProps) {
  const t = useTranslations('files');

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-[var(--text-primary)]" title={item.file.name}>{item.file.name}</span>
          {item.status === 'done' && <CheckCircle2 size={14} className="shrink-0 text-[var(--success)]" />}
          {item.status === 'error' && <AlertCircle size={14} className="shrink-0 text-[var(--danger)]" />}
        </div>
        {(item.status === 'uploading' || item.status === 'queued') && <UploadProgressBar value={item.progress} />}
        {item.status === 'error' && <span className="text-xs text-[var(--danger)]">{t('upload.itemFailed')}</span>}
      </div>
      {item.status === 'error' && (
        <button type="button" onClick={() => onRetry(item.id)} aria-label={t('upload.retry')} className="rounded p-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]">
          <RotateCcw size={14} strokeWidth={1.75} />
        </button>
      )}
      {(item.status === 'done' || item.status === 'error') && (
        <button type="button" onClick={() => onRemove(item.id)} aria-label={t('upload.dismiss')} className="rounded p-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]">
          <X size={14} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}
