'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight, Folder } from 'lucide-react';
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
 *
 * Items from a folder upload carry a `group` (the top-level folder name) and
 * are collapsed under one summary row, so a large folder doesn't turn the
 * panel into a long flat list.
 */
export default function UploadProgressPanel({ items, onRetry, onRemove }: UploadProgressPanelProps) {
  const t = useTranslations('files');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (items.length === 0) return null;

  const ungrouped = items.filter((item) => !item.group);
  const groups = new Map<string, UploadItem[]>();
  for (const item of items) {
    if (item.group) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  }

  const toggle = (name: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <div className="fixed bottom-4 right-4 z-[60] max-h-[70vh] w-[min(92vw,360px)] space-y-2 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 shadow-2xl">
      {Array.from(groups.entries()).map(([name, groupItems]) => {
        const done = groupItems.filter((item) => item.status === 'done').length;
        const failed = groupItems.filter((item) => item.status === 'error').length;
        const isOpen = expanded.has(name);
        const percent = Math.round(groupItems.reduce((sum, item) => sum + item.progress, 0) / groupItems.length);
        return (
          <div key={name} className="space-y-2">
            <button type="button" onClick={() => toggle(name)} className="flex w-full items-center gap-2 text-left text-sm text-[var(--text-primary)]">
              {isOpen ? <ChevronDown size={14} strokeWidth={1.75} /> : <ChevronRight size={14} strokeWidth={1.75} />}
              <Folder size={14} strokeWidth={1.75} className="text-[var(--text-tertiary)]" />
              <span className="min-w-0 flex-1 truncate">{name}</span>
              <span className="text-xs text-[var(--text-tertiary)]">
                {t('newMenu.groupCount', { done, total: groupItems.length })}
                {failed > 0 && ` · ${t('newMenu.groupErrors', { count: failed })}`}
              </span>
            </button>
            <div className="h-1 overflow-hidden rounded-full bg-[var(--bg-active)]">
              <div className="h-full bg-[var(--accent)] transition-[width]" style={{ width: `${percent}%` }} />
            </div>
            {isOpen && (
              <div className="space-y-2 pl-4">
                {groupItems.map((item) => (
                  <UploadItemRow key={item.id} item={item} onRetry={onRetry} onRemove={onRemove} />
                ))}
              </div>
            )}
          </div>
        );
      })}
      {ungrouped.map((item) => (
        <UploadItemRow key={item.id} item={item} onRetry={onRetry} onRemove={onRemove} />
      ))}
    </div>
  );
}
