'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import * as Tabs from '@radix-ui/react-tabs';
import clsx from 'clsx';
import { Link2, Share2, Users } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import {
  listGroupShares, shareWithGroup, revokeGroupShare,
  listUserShares, shareWithUser, revokeUserShare,
} from '@/lib/api/files';
import {
  listFolderGroupShares, shareFolderWithGroup, revokeFolderGroupShare,
  listFolderUserShares, shareFolderWithUser, revokeFolderUserShare,
} from '@/lib/api/folders';
import { getUserGroups } from '@/lib/api/groups';
import { translateFileApiError } from '@/lib/i18n/files';
import { translateFolderApiError } from '@/lib/i18n/folders';
import type { ShareFlagSet } from '@/lib/permissions/filesGuard';
import ShareGroupTab from './ShareGroupTab';
import ShareUserTab from './ShareUserTab';
import SharePublicLinkTab from './SharePublicLinkTab';

export interface ShareModalProps {
  open: boolean;
  kind: 'file' | 'folder';
  entityId: string;
  isOwner: boolean;
  onClose: () => void;
}

export default function ShareModal({ open, kind, entityId, isOwner, onClose }: ShareModalProps) {
  const t = useTranslations('files');
  const tf = useTranslations('folders');
  const [activeTab, setActiveTab] = useState('users');

  const [groupShares, setGroupShares] = useState<Array<{ group_id: string; group_name: string }>>([]);
  const [userShares, setUserShares] = useState<Array<{ user_id: string; user_name: string; can_view: boolean; can_download: boolean; can_upload?: boolean; can_edit: boolean; can_delete: boolean; can_share: boolean }>>([]);
  const [userGroups, setUserGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingShares, setIsLoadingShares] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [revokingGroupId, setRevokingGroupId] = useState<string | null>(null);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);

  const translateError = useCallback((error: unknown) => (kind === 'file' ? translateFileApiError(t, error, 'errors.default') : translateFolderApiError(tf, error, 'errors.default')), [kind, t, tf]);

  const loadShares = useCallback(async () => {
    if (!open) return;
    setIsLoadingShares(true);
    try {
      const [groupResponse, userResponse, groupsResponse] = await Promise.all([
        kind === 'file' ? listGroupShares(entityId) : listFolderGroupShares(entityId),
        kind === 'file' ? listUserShares(entityId) : listFolderUserShares(entityId),
        getUserGroups(),
      ]);
      setGroupShares(groupResponse.data.groups);
      setUserShares(userResponse.data.users);
      const source = (groupsResponse as {data?: unknown}).data ?? groupsResponse;
      const array = source && typeof source === 'object' ? (['group_users', 'groups', 'items', 'result'].map((k) => (source as Record<string, unknown>)[k]).find(Array.isArray) as unknown[] | undefined) : undefined;
      setUserGroups((array ?? []).map((item) => {
        const row = item as Record<string, unknown>;
        return { id: String(row.group_id ?? row.id ?? ''), name: String(row.group_name ?? row.name ?? '') };
      }).filter((g) => g.id));
    } catch (error) {
      toast.error(translateError(error));
    } finally {
      setIsLoadingShares(false);
    }
  }, [open, kind, entityId, translateError]);

  useEffect(() => {
    void loadShares();
  }, [loadShares]);

  const myFlags: ShareFlagSet = isOwner
    ? { can_view: true, can_download: true, can_upload: true, can_edit: true, can_delete: true, can_share: true }
    : { can_view: true, can_download: true };

  const handleShareGroup = async (groupId: string, canUpload: boolean) => {
    setIsSharing(true);
    try {
      if (kind === 'file') await shareWithGroup(entityId, groupId);
      else await shareFolderWithGroup(entityId, groupId, { can_upload: canUpload });
      toast.success(kind === 'file' ? t('toasts.shareSuccess') : tf('toasts.shareSuccess'));
      await loadShares();
    } catch (error) {
      toast.error(translateError(error));
    } finally {
      setIsSharing(false);
    }
  };

  const handleRevokeGroup = async (groupId: string) => {
    setRevokingGroupId(groupId);
    try {
      if (kind === 'file') await revokeGroupShare(entityId, groupId);
      else await revokeFolderGroupShare(entityId, groupId);
      toast.success(kind === 'file' ? t('toasts.revokeSuccess') : tf('toasts.revokeSuccess'));
      await loadShares();
    } catch (error) {
      toast.error(translateError(error));
    } finally {
      setRevokingGroupId(null);
    }
  };

  const handleShareUser = async (targetUserId: string, flags: ShareFlagSet) => {
    setIsSharing(true);
    try {
      if (kind === 'file') await shareWithUser(entityId, targetUserId, flags);
      else await shareFolderWithUser(entityId, targetUserId, flags);
      toast.success(kind === 'file' ? t('toasts.shareSuccess') : tf('toasts.shareSuccess'));
      await loadShares();
    } catch (error) {
      toast.error(translateError(error));
    } finally {
      setIsSharing(false);
    }
  };

  const handleRevokeUser = async (targetUserId: string) => {
    setRevokingUserId(targetUserId);
    try {
      if (kind === 'file') await revokeUserShare(entityId, targetUserId);
      else await revokeFolderUserShare(entityId, targetUserId);
      toast.success(kind === 'file' ? t('toasts.revokeSuccess') : tf('toasts.revokeSuccess'));
      await loadShares();
    } catch (error) {
      toast.error(translateError(error));
    } finally {
      setRevokingUserId(null);
    }
  };

  return (
    <Modal open={open} title={kind === 'file' ? t('share.modalTitle') : tf('share.modalTitle')} onClose={onClose}>
      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List className="mb-4 flex border-b border-[var(--border-subtle)]">
          {[
            { value: 'users', label: t('share.tabs.users'), icon: Share2 },
            { value: 'groups', label: t('share.tabs.groups'), icon: Users },
            ...(kind === 'file' ? [{ value: 'link', label: t('share.tabs.link'), icon: Link2 }] : []),
          ].map(({ value, label, icon: Icon }) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className={clsx(
                'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold outline-none transition-all',
                activeTab === value ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              )}
            >
              <Icon size={16} /> {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="users">
          <ShareUserTab
            shares={userShares}
            isLoading={isLoadingShares}
            myFlags={myFlags}
            showCanUpload={kind === 'folder'}
            isSharing={isSharing}
            revokingUserId={revokingUserId}
            onShare={handleShareUser}
            onRevoke={handleRevokeUser}
          />
        </Tabs.Content>

        <Tabs.Content value="groups">
          <ShareGroupTab
            shares={groupShares}
            userGroups={userGroups}
            isLoading={isLoadingShares}
            showCanUpload={kind === 'folder'}
            myFlags={myFlags}
            isSharing={isSharing}
            revokingGroupId={revokingGroupId}
            onShare={handleShareGroup}
            onRevoke={handleRevokeGroup}
          />
        </Tabs.Content>

        {kind === 'file' && (
          <Tabs.Content value="link">
            <SharePublicLinkTab fileId={entityId} />
          </Tabs.Content>
        )}
      </Tabs.Root>
    </Modal>
  );
}
