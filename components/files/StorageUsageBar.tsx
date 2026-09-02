'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import * as Progress from '@radix-ui/react-progress';
import { getStorageUsage, type FileScope } from '@/lib/api/files';
import { formatFileSize } from '@/lib/utils/formatFiles';

export interface StorageUsageBarProps {
  scope: FileScope;
  groupId?: string;
  /**
   * Bump this (e.g. a counter incremented after every successful upload/
   * delete/move/rename) to force a re-fetch. Storage usage otherwise only
   * loads once per `[scope, groupId]` pair and goes stale after a mutation.
   */
  refreshKey?: number | string;
}

function barColor(percent: number): string {
  if (percent >= 95) return 'bg-[var(--danger)]';
  if (percent >= 80) return 'bg-[var(--warning)]';
  return 'bg-[var(--accent)]';
}

export default function StorageUsageBar({ scope, groupId, refreshKey }: StorageUsageBarProps) {
  const t = useTranslations('files');
  const [usedBytes, setUsedBytes] = useState<number | null>(null);
  const [limitBytes, setLimitBytes] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    getStorageUsage(scope, scope === 'group' ? groupId : undefined)
      .then((response) => {
        if (!mounted) return;
        setUsedBytes(response.data.used_bytes);
        setLimitBytes(response.data.limit_bytes);
      })
      .catch(() => {
        if (mounted) {
          setUsedBytes(null);
          setLimitBytes(null);
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [scope, groupId, refreshKey]);

  if (isLoading || usedBytes === null) {
    return <div className="h-8 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />;
  }

  if (limitBytes === null) {
    return (
      <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
        <span>{formatFileSize(usedBytes)}</span>
        <span>{t('storage.unlimited')}</span>
      </div>
    );
  }

  const percent = limitBytes === 0 ? 100 : Math.min(100, (usedBytes / limitBytes) * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
        <span>{formatFileSize(usedBytes)} / {formatFileSize(limitBytes)}</span>
        <span>{Math.round(percent)}%</span>
      </div>
      <Progress.Root value={percent} className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
        <Progress.Indicator
          className={`block h-full w-full transition-transform duration-200 ease-out ${barColor(percent)}`}
          style={{ transform: `translateX(-${100 - percent}%)` }}
        />
      </Progress.Root>
    </div>
  );
}
