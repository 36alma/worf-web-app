'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { bulkShareWithGroup } from '@/lib/api/files';
import { getUserGroups } from '@/lib/api/groups';
import { translateFileApiError } from '@/lib/i18n/files';

export interface BulkShareDialogProps {
  open: boolean;
  fileIds: string[];
  onClose: () => void;
  onShared?: () => void;
}

/** Extracts a normalized {id,name}[] group list from whatever shape getUserGroups() returns — same defensive parsing ShareModal.tsx already uses for the same endpoint. */
function extractGroups(response: unknown): Array<{ id: string; name: string }> {
  const source = (response as { data?: unknown })?.data ?? response;
  const array = source && typeof source === 'object'
    ? (['group_users', 'groups', 'items', 'result'].map((key) => (source as Record<string, unknown>)[key]).find(Array.isArray) as unknown[] | undefined)
    : undefined;
  return (array ?? [])
    .map((item) => {
      const row = item as Record<string, unknown>;
      return { id: String(row.group_id ?? row.id ?? ''), name: String(row.group_name ?? row.name ?? '') };
    })
    .filter((group) => group.id);
}

export default function BulkShareDialog({ open, fileIds, onClose, onShared }: BulkShareDialogProps) {
  const t = useTranslations('files');
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedGroupId('');
    setIsLoading(true);
    getUserGroups()
      .then((response) => setGroups(extractGroups(response)))
      .catch((error) => toast.error(translateFileApiError(t, error, 'errors.default')))
      .finally(() => setIsLoading(false));
  }, [open, t]);

  const handleShare = async () => {
    if (!selectedGroupId) return;
    setIsSharing(true);
    try {
      const response = await bulkShareWithGroup(fileIds, selectedGroupId);
      const { succeeded, failed } = response.data;
      if (succeeded.length > 0) toast.success(t('bulk.shareSummary', { succeeded: succeeded.length, total: fileIds.length }));
      if (failed.length > 0) toast.error(t('bulk.shareFailedDetail', { items: failed.map((item) => item.file_id).join(', ') }));
      onShared?.();
      onClose();
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Modal open={open} title={t('bulk.share')} onClose={() => (isSharing ? undefined : onClose())}>
      <div className="space-y-3">
        <div>
          <label htmlFor="bulk-share-group-select" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            {t('share.title')}
          </label>
          <select
            id="bulk-share-group-select"
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus-visible:border-border-focus"
            value={selectedGroupId}
            onChange={(event) => setSelectedGroupId(event.target.value)}
            disabled={isLoading}
          >
            <option value="">{t('share.selectGroupPlaceholder')}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSharing}>{t('upload.cancel')}</Button>
          <Button type="button" variant="primary" loading={isSharing} disabled={!selectedGroupId} onClick={() => void handleShare()}>{t('share.shareButton')}</Button>
        </div>
      </div>
    </Modal>
  );
}
