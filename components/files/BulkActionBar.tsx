'use client';

import { useTranslations } from 'next-intl';
import { Download, Trash2, Users, X } from 'lucide-react';
import Button from '@/components/ui/Button';

const MAX_BULK_SHARE_COUNT = 100;

export interface BulkActionBarProps {
  count: number;
  /** Files-only subset of the current selection — the share cap (spec §3.3) applies to files only, not folders. */
  shareableCount: number;
  onDownloadAll: () => void;
  onDeleteAll: () => void;
  onShareAll: () => void;
  onClear: () => void;
  isBusy?: boolean;
}

export default function BulkActionBar({ count, shareableCount, onDownloadAll, onDeleteAll, onShareAll, onClear, isBusy }: BulkActionBarProps) {
  const t = useTranslations('files');
  if (count === 0) return null;

  const tooManyForShare = shareableCount > MAX_BULK_SHARE_COUNT;

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-2.5 shadow-2xl">
        <span className="text-sm text-[var(--text-primary)]">{t('bulk.selectedCount', { count })}</span>
        <Button type="button" variant="secondary" size="sm" onClick={onDownloadAll} disabled={isBusy}>
          <Download size={14} strokeWidth={1.75} className="mr-1" />
          {t('bulk.download')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onShareAll}
          disabled={isBusy || tooManyForShare}
          title={tooManyForShare ? t('bulk.tooManyForShare') : undefined}
          aria-label={tooManyForShare ? t('bulk.tooManyForShare') : t('bulk.share')}
        >
          <Users size={14} strokeWidth={1.75} className="mr-1" />
          {t('bulk.share')}
        </Button>
        <Button type="button" variant="danger" size="sm" onClick={onDeleteAll} disabled={isBusy}>
          <Trash2 size={14} strokeWidth={1.75} className="mr-1" />
          {t('bulk.delete')}
        </Button>
        <button type="button" onClick={onClear} aria-label={t('bulk.clear')} className="rounded p-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]">
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
