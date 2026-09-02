'use client';

import { useTranslations } from 'next-intl';
import { Download, FolderInput, Trash2, Users, X } from 'lucide-react';
import Button from '@/components/ui/Button';

const MAX_BULK_SHARE_COUNT = 100;

export interface BulkActionBarProps {
  count: number;
  /** Files-only subset of the current selection — the share cap (spec §3.3) applies to files only, not folders. */
  shareableCount: number;
  onDownloadAll: () => void;
  onDeleteAll: () => void;
  onShareAll: () => void;
  /** Unlike share/download, bulk move applies to both files AND folders in the selection — no count cap. */
  onMoveAll: () => void;
  onClear: () => void;
  isBusy?: boolean;
}

export default function BulkActionBar({ count, shareableCount, onDownloadAll, onDeleteAll, onShareAll, onMoveAll, onClear, isBusy }: BulkActionBarProps) {
  const t = useTranslations('files');
  if (count === 0) return null;

  const tooManyForShare = shareableCount > MAX_BULK_SHARE_COUNT;

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      {/* size="sm" (h-8/32px, see Button.tsx) is kept deliberately — bumping
          it would only make the width problem below worse. The real 375px
          risk here isn't button height, it's total row width: 4 labeled
          buttons (one label, "Share with group"/"Megosztás csoporttal", is
          long) plus the count text and clear button add up to well over a
          375px screen with no wrap/scroll handling. Fix: let the pill itself
          shrink to the available width (it's a flex item of the `justify-
          center` row above, so nothing bounds its width otherwise) and make
          just the button group scroll horizontally, matching the FilesFeed
          toolbar's pattern — count and the clear ("x") button stay pinned
          and always reachable. */}
      <div className="flex min-w-0 items-center gap-3 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-2.5 shadow-2xl">
        <span className="shrink-0 text-sm text-[var(--text-primary)]">{t('bulk.selectedCount', { count })}</span>
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
          <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={onDownloadAll} disabled={isBusy}>
            <Download size={14} strokeWidth={1.75} className="mr-1" />
            {t('bulk.download')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={onShareAll}
            disabled={isBusy || tooManyForShare}
            title={tooManyForShare ? t('bulk.tooManyForShare') : undefined}
            aria-label={tooManyForShare ? t('bulk.tooManyForShare') : t('bulk.share')}
          >
            <Users size={14} strokeWidth={1.75} className="mr-1" />
            {t('bulk.share')}
          </Button>
          <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={onMoveAll} disabled={isBusy}>
            <FolderInput size={14} strokeWidth={1.75} className="mr-1" />
            {t('bulk.move')}
          </Button>
          <Button type="button" variant="danger" size="sm" className="shrink-0" onClick={onDeleteAll} disabled={isBusy}>
            <Trash2 size={14} strokeWidth={1.75} className="mr-1" />
            {t('bulk.delete')}
          </Button>
        </div>
        <button type="button" onClick={onClear} aria-label={t('bulk.clear')} className="shrink-0 rounded p-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]">
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
