'use client';

import type { UploadItem } from '@/hooks/useUploadQueue';
import UploadItemRow from './UploadItemRow';

export interface UploadProgressPanelProps {
  items: UploadItem[];
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

/**
 * Tracks uploads still running (or needing a retry) after the upload dialog
 * has been closed. z-[60] — one above Modal's z-50 — so a still-open or
 * freshly-reopened dialog never hides this panel behind its overlay; while
 * the dialog IS open, the same items are also shown inline inside it
 * (UploadDialog.tsx), so the two never need to compete for visibility.
 */
export default function UploadProgressPanel({ items, onRetry, onRemove }: UploadProgressPanelProps) {
  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[min(92vw,360px)] space-y-2 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 shadow-2xl">
      {items.map((item) => (
        <UploadItemRow key={item.id} item={item} onRetry={onRetry} onRemove={onRemove} />
      ))}
    </div>
  );
}
