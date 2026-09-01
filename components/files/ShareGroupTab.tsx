'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';

export interface ShareGroupEntry {
  group_id: string;
  group_name: string;
}

export interface SelectableGroup {
  id: string;
  name: string;
}

export interface ShareGroupTabProps {
  shares: ShareGroupEntry[];
  userGroups: SelectableGroup[];
  isLoading: boolean;
  showCanUpload?: boolean;
  isSharing: boolean;
  revokingGroupId: string | null;
  onShare: (groupId: string, canUpload: boolean) => Promise<void>;
  onRevoke: (groupId: string) => Promise<void>;
}

export default function ShareGroupTab({ shares, userGroups, isLoading, showCanUpload, isSharing, revokingGroupId, onShare, onRevoke }: ShareGroupTabProps) {
  const t = useTranslations('files');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [canUpload, setCanUpload] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="share-group-select" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            {t('share.title')}
          </label>
          <select
            id="share-group-select"
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus-visible:border-border-focus"
            value={selectedGroupId}
            onChange={(event) => setSelectedGroupId(event.target.value)}
          >
            <option value="">{t('share.selectGroupPlaceholder')}</option>
            {userGroups.filter((group) => !shares.some((share) => share.group_id === group.id)).map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </div>
        <Button type="button" variant="primary" loading={isSharing} disabled={!selectedGroupId} onClick={() => void onShare(selectedGroupId, canUpload).then(() => setSelectedGroupId(''))}>
          {t('share.shareButton')}
        </Button>
      </div>

      {showCanUpload && (
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <Switch checked={canUpload} onCheckedChange={setCanUpload} />
          {t('share.canUpload')}
        </label>
      )}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">{t('share.sharedWith')}</p>
        {isLoading ? (
          <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
        ) : shares.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">{t('share.noShares')}</p>
        ) : (
          <ul className="space-y-2">
            {shares.map((share) => (
              <li key={share.group_id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm">
                <span className="font-medium text-[var(--text-primary)]">{share.group_name}</span>
                <Button type="button" variant="ghost" size="sm" loading={revokingGroupId === share.group_id} onClick={() => void onRevoke(share.group_id)}>
                  {t('share.revokeButton')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
