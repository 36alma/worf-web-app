'use client';

import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import GroupRolesManager from './GroupRolesManager';
import Skeleton from '@/components/ui/Skeleton';
import { useEffect, useState } from 'react';
import { getAllGroups } from '@/lib/api/groups';

interface GroupRolesModalProps {
  open: boolean;
  groupId: string;
  onClose: () => void;
}

interface GroupInfo {
  id: string;
  name: string;
}

export default function GroupRolesModal({ open, groupId, onClose }: GroupRolesModalProps) {
  const t = useTranslations('admin');
  const [groupName, setGroupName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !groupId) {
      setLoading(true);
      return;
    }

    const loadGroupName = async () => {
      setLoading(true);
      try {
        const response = await getAllGroups();
        const groups = Array.isArray(response.data) ? response.data : response.data?.data || [];
        const group = groups.find((g: any) => (g.group_id ?? g.id) === groupId);
        if (group) {
          setGroupName(group.group_name ?? group.name ?? groupId);
        }
      } catch (error) {
        console.error('Failed to load group name:', error);
        setGroupName(groupId);
      } finally {
        setLoading(false);
      }
    };

    loadGroupName();
  }, [open, groupId]);

  return (
    <Modal
      open={open}
      title={`${t('manage_roles_title')}${groupName ? `: ${groupName}` : ''}`}
      onClose={onClose}
    >
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <div className="max-h-[80vh] overflow-y-auto">
          <GroupRolesManager groupId={groupId} onClose={onClose} />
        </div>
      )}
    </Modal>
  );
}
