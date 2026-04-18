'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { getGroupRoles } from '@/lib/api/groups';
import { hasPermissionRequirement } from '@/lib/permissions/access';
import { usePermissionStore } from '@/lib/store/permissionStore';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

interface Role {
  group_role_id?: string;
  id?: string;
  group_role_name?: string;
  name?: string;
  group_role_description?: string;
  description?: string;
}

interface GroupRolePickerModalProps {
  open: boolean;
  groupId: string;
  onClose: () => void;
  onSelect: (roleId: string | null) => Promise<void>;
  currentRoleId?: string;
}

export default function GroupRolePickerModal({
  open,
  groupId,
  onClose,
  onSelect,
  currentRoleId
}: GroupRolePickerModalProps) {
  const t = useTranslations('admin');
  const { systemPermissions, isSystemPermissionsLoaded } = usePermissionStore();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canManageRoles =
    isSystemPermissionsLoaded &&
    hasPermissionRequirement(systemPermissions, { anyOf: ['group.admin.role.management'] });

  useEffect(() => {
    if (!open || !groupId || !canManageRoles) {
      return;
    }

    const loadRoles = async () => {
      setLoading(true);
      try {
        const response = await getGroupRoles(groupId);
        
        // Parse roles - handle multiple response formats
        let rolesData: any[] = [];
        const res = response as any;
        if (Array.isArray(res?.data)) {
          rolesData = res.data;
        } else if (res?.data?.group_roles && Array.isArray(res.data.group_roles)) {
          rolesData = res.data.group_roles;
        } else if (res?.data?.roles && Array.isArray(res.data.roles)) {
          rolesData = res.data.roles;
        } else if (res?.data?.data && Array.isArray(res.data.data)) {
          rolesData = res.data.data;
        } else if (res?.group_roles && Array.isArray(res.group_roles)) {
          rolesData = res.group_roles;
        }

        const roleList: Role[] = Array.isArray(rolesData)
          ? rolesData
              .filter((role: any) => role?.group_role_id || role?.id)
              .map((role: any) => ({
                group_role_id: role.group_role_id ?? role.id,
                group_role_name: role.group_role_name ?? role.name,
                group_role_description: role.group_role_description ?? role.description
              }))
          : [];
        
        setRoles(roleList);
        setSelectedRoleId(currentRoleId ?? (roleList[0]?.group_role_id ?? null));
      } catch (error) {
        toast.error(t('load_error'));
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    loadRoles();
  }, [open, groupId, currentRoleId, t, canManageRoles]);

  if (!canManageRoles) {
    return null;
  }

  const handleSelect = async () => {
    try {
      setSaving(true);
      await onSelect(selectedRoleId);
      onClose();
    } catch {
      toast.error(t('save_error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={t('set_role_title')} onClose={onClose}>
      <div className="space-y-4">
        {loading ? (
          <div className="py-8 text-center text-[var(--text-secondary)]">Loading roles...</div>
        ) : roles.length === 0 ? (
          <div className="py-8 text-center text-[var(--text-secondary)]">No roles available</div>
        ) : (
          <div className="space-y-2">
            <label className="flex cursor-pointer items-start gap-3 rounded p-2 hover:bg-[var(--bg-hover)]">
              <input
                type="radio"
                name="role"
                value=""
                checked={selectedRoleId === null}
                onChange={() => setSelectedRoleId(null)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium text-[var(--text-primary)]">{t('none')}</div>
              </div>
            </label>
            {roles.map((role) => {
              const roleId = role.group_role_id ?? role.id ?? '';
              return (
                <label key={roleId} className="flex cursor-pointer items-start gap-3 rounded p-2 hover:bg-[var(--bg-hover)]">
                  <input
                    type="radio"
                    name="role"
                    value={roleId}
                    checked={selectedRoleId === roleId}
                    onChange={() => setSelectedRoleId(roleId)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-[var(--text-primary)]">
                      {role.group_role_name ?? role.name ?? roleId} 
                    </div>
                    {(role.group_role_description ?? role.description) && (
                      <div className="text-xs text-[var(--text-secondary)]">
                        {role.group_role_description ?? role.description}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
          <Button className="p-2" variant="ghost" type="button" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button className="p-2" type="button" disabled={saving} onClick={handleSelect}>
            {saving ? t('saving') : t('set_role')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
