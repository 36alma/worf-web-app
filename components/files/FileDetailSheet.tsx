'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import * as Tabs from '@radix-ui/react-tabs';
import clsx from 'clsx';
import { FileText, History, Share2 } from 'lucide-react';
import SideSheet from '@/components/ui/SideSheet';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Button from '@/components/ui/Button';
import {
  getFileMetadata,
  requestDownload,
  buildDownloadUrl,
  deleteFile,
  listGroupShares,
  shareWithGroup,
  revokeGroupShare,
  getAuditLog,
  type FileMetadataResponse,
  type FileGroupShareEntry,
  type FileAuditLogEntry,
} from '@/lib/api/files';
import { getUserGroups } from '@/lib/api/groups';
import { translateFileApiError } from '@/lib/i18n/files';
import { formatFileSize, formatMimeType, formatUploadedAt } from '@/lib/utils/formatFiles';

interface SelectableGroup {
  id: string;
  name: string;
}

const AUDIT_PAGE_SIZE = 20;

const readGroupsResponse = (payload: unknown): SelectableGroup[] => {
  if (!payload || typeof payload !== 'object') return [];
  const source = ('data' in (payload as Record<string, unknown>)
    ? (payload as Record<string, unknown>).data
    : payload) as unknown;
  const arrayValue = Array.isArray(source)
    ? source
    : source && typeof source === 'object'
      ? ['group_users', 'groups', 'items', 'rows', 'result']
          .map((key) => (source as Record<string, unknown>)[key])
          .find((value) => Array.isArray(value))
      : null;
  if (!Array.isArray(arrayValue)) return [];
  return arrayValue
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const id = String(row.group_id ?? row.id ?? '').trim();
      if (!id) return null;
      return { id, name: String(row.group_name ?? row.name ?? id) };
    })
    .filter((value): value is SelectableGroup => value !== null);
};

export interface FileDetailSheetProps {
  fileId: string | null;
  onClose: () => void;
  onDeleted?: () => void;
}

const DOWNLOAD_DEBOUNCE_MS = 2000;

export default function FileDetailSheet({ fileId, onClose, onDeleted }: FileDetailSheetProps) {
  const t = useTranslations('files');

  const [activeTab, setActiveTab] = useState('metadata');
  const [metadata, setMetadata] = useState<FileMetadataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const [shares, setShares] = useState<FileGroupShareEntry[]>([]);
  const [isSharesLoading, setIsSharesLoading] = useState(false);
  const [userGroups, setUserGroups] = useState<SelectableGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [revokingGroupId, setRevokingGroupId] = useState<string | null>(null);

  const [auditItems, setAuditItems] = useState<FileAuditLogEntry[]>([]);
  const [auditOffset, setAuditOffset] = useState(0);
  const [auditTotal, setAuditTotal] = useState(0);
  const [isAuditLoading, setIsAuditLoading] = useState(false);

  useEffect(() => {
    if (fileId === null) {
      setMetadata(null);
      return;
    }

    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      try {
        const response = await getFileMetadata(fileId);
        if (!mounted) return;
        setMetadata(response.data);
      } catch (error) {
        if (!mounted) return;
        toast.error(translateFileApiError(t, error, 'errors.default'));
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [fileId, t]);

  useEffect(() => {
    if (fileId === null) {
      setActiveTab('metadata');
      setShares([]);
      setUserGroups([]);
      setSelectedGroupId('');
      setAuditItems([]);
      setAuditOffset(0);
      setAuditTotal(0);
    }
  }, [fileId]);

  const loadShares = useCallback(async () => {
    if (fileId === null) return;
    setIsSharesLoading(true);
    try {
      const [sharesResponse, groupsResponse] = await Promise.all([listGroupShares(fileId), getUserGroups()]);
      setShares(sharesResponse.data.groups);
      setUserGroups(readGroupsResponse(groupsResponse));
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    } finally {
      setIsSharesLoading(false);
    }
  }, [fileId, t]);

  const loadAudit = useCallback(
    async (nextOffset: number) => {
      if (fileId === null) return;
      setIsAuditLoading(true);
      try {
        const response = await getAuditLog(fileId, nextOffset, AUDIT_PAGE_SIZE);
        setAuditItems((current) => (nextOffset === 0 ? response.data.items : [...current, ...response.data.items]));
        setAuditTotal(response.data.total);
        setAuditOffset(nextOffset);
      } catch (error) {
        toast.error(translateFileApiError(t, error, 'errors.default'));
      } finally {
        setIsAuditLoading(false);
      }
    },
    [fileId, t]
  );

  useEffect(() => {
    if (fileId === null) return;
    if (activeTab === 'share' && metadata?.is_owner) {
      void loadShares();
    }
    if (activeTab === 'audit') {
      void loadAudit(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, fileId, metadata?.is_owner]);

  const handleShare = async () => {
    if (fileId === null || !selectedGroupId || isSharing) return;
    setIsSharing(true);
    try {
      await shareWithGroup(fileId, selectedGroupId);
      toast.success(t('toasts.shareSuccess'));
      setSelectedGroupId('');
      await loadShares();
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    } finally {
      setIsSharing(false);
    }
  };

  const handleRevoke = async (groupId: string) => {
    if (fileId === null || revokingGroupId) return;
    setRevokingGroupId(groupId);
    try {
      await revokeGroupShare(fileId, groupId);
      toast.success(t('toasts.revokeSuccess'));
      await loadShares();
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    } finally {
      setRevokingGroupId(null);
    }
  };

  const handleDownload = async () => {
    if (fileId === null || isRequesting) return;
    setIsRequesting(true);
    try {
      const response = await requestDownload(fileId);
      window.location.href = buildDownloadUrl(response.data.download_token);
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    } finally {
      setTimeout(() => setIsRequesting(false), DOWNLOAD_DEBOUNCE_MS);
    }
  };

  const handleDeleteConfirm = async () => {
    if (fileId === null) return;
    setIsDeleting(true);
    try {
      await deleteFile(fileId);
      toast.success(t('toasts.deleteSuccess'));
      setIsConfirmOpen(false);
      onClose();
      onDeleted?.();
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <SideSheet open={fileId !== null} title={t('detail.title')} onClose={onClose}>
        <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex h-full w-full flex-col">
          <Tabs.List className="mb-6 mt-[-10px] flex border-b border-[var(--border-subtle)]">
            <Tabs.Trigger
              value="metadata"
              className={clsx(
                'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold outline-none transition-all',
                activeTab === 'metadata'
                  ? 'border-orange-500 text-orange-500'
                  : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              )}
            >
              <FileText size={16} /> {t('detail.tabs.metadata')}
            </Tabs.Trigger>
            <Tabs.Trigger
              value="share"
              className={clsx(
                'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold outline-none transition-all',
                activeTab === 'share'
                  ? 'border-orange-500 text-orange-500'
                  : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              )}
            >
              <Share2 size={16} /> {t('detail.tabs.share')}
            </Tabs.Trigger>
            <Tabs.Trigger
              value="audit"
              className={clsx(
                'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold outline-none transition-all',
                activeTab === 'audit'
                  ? 'border-orange-500 text-orange-500'
                  : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              )}
            >
              <History size={16} /> {t('detail.tabs.audit')}
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="metadata" className="flex flex-col gap-4 outline-none">
            {isLoading || !metadata ? (
              <div className="space-y-2">
                <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
                <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
                <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
              </div>
            ) : (
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{t('detail.fields.name')}</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">{metadata.original_name}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{t('detail.fields.type')}</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">
                    {formatMimeType(metadata.mime_type)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{t('detail.fields.size')}</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">
                    {formatFileSize(metadata.size_bytes)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{t('detail.fields.uploadedAt')}</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">
                    {formatUploadedAt(metadata.uploaded_at)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{t('detail.fields.scope')}</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">
                    {metadata.scope === 'group' ? t('detail.scopeValues.group') : t('detail.scopeValues.private')}
                  </dd>
                </div>
              </dl>
            )}

            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="primary"
                onClick={handleDownload}
                disabled={fileId === null || isRequesting}
              >
                {t('detail.download')}
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => setIsConfirmOpen(true)}
                disabled={fileId === null || isLoading}
              >
                {t('detail.delete')}
              </Button>
            </div>
          </Tabs.Content>

          <Tabs.Content value="share" className="flex flex-col gap-4 outline-none">
            {!metadata ? null : !metadata.is_owner ? (
              <p className="text-sm text-[var(--text-tertiary)]">{t('share.ownerOnly')}</p>
            ) : (
              <>
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
                      {userGroups
                        .filter((group) => !shares.some((share) => share.group_id === group.id))
                        .map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <Button type="button" variant="primary" loading={isSharing} disabled={!selectedGroupId} onClick={handleShare}>
                    {t('share.shareButton')}
                  </Button>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                    {t('share.sharedWith')}
                  </p>
                  {isSharesLoading ? (
                    <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
                  ) : shares.length === 0 ? (
                    <p className="text-sm text-[var(--text-tertiary)]">{t('share.noShares')}</p>
                  ) : (
                    <ul className="space-y-2">
                      {shares.map((share) => (
                        <li
                          key={share.group_id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-[var(--text-primary)]">{share.group_name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            loading={revokingGroupId === share.group_id}
                            onClick={() => handleRevoke(share.group_id)}
                          >
                            {t('share.revokeButton')}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </Tabs.Content>

          <Tabs.Content value="audit" className="flex flex-col gap-4 outline-none">
            {isAuditLoading && auditItems.length === 0 ? (
              <div className="space-y-2">
                <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
                <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
              </div>
            ) : auditItems.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">{t('audit.emptyText')}</p>
            ) : (
              <ul className="space-y-2">
                {auditItems.map((entry) => (
                  <li key={entry.id} className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-[var(--text-primary)]">
                        {t.has(`audit.action.${entry.action}` as any)
                          ? t(`audit.action.${entry.action}` as any)
                          : entry.action}
                      </span>
                      <span className="text-xs text-[var(--text-tertiary)]">{formatUploadedAt(entry.timestamp)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {auditItems.length < auditTotal && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={isAuditLoading}
                onClick={() => loadAudit(auditOffset + AUDIT_PAGE_SIZE)}
              >
                {t('audit.loadMore')}
              </Button>
            )}
          </Tabs.Content>
        </Tabs.Root>
      </SideSheet>

      <ConfirmDialog
        open={isConfirmOpen}
        title={t('detail.confirmDelete.title')}
        message={t('detail.confirmDelete.message')}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          if (!isDeleting) {
            void handleDeleteConfirm();
          }
        }}
      />
    </>
  );
}
