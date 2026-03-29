'use client';

import {FormEvent, useCallback, useEffect, useMemo, useState} from 'react';
import toast from 'react-hot-toast';
import {useTranslations} from 'next-intl';
import {getAdminUsers} from '@/lib/api/admin';
import {
  addUserToGroup,
  createGroup,
  deleteGroup,
  getAllGroups,
  modifyGroupBase,
  removeUserFromGroup
} from '@/lib/api/groups';
import {hasPermissionRequirement} from '@/lib/permissions/access';
import {usePermissionStore} from '@/lib/store/permissionStore';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import Skeleton from '@/components/ui/Skeleton';

type RawObject = Record<string, unknown>;

interface GroupRow {
  id: string;
  name: string;
  description: string;
}

interface GroupFormState {
  id?: string;
  name: string;
  description: string;
}

interface UserRow {
  id: string;
  username: string;
  email: string;
  full_name: string;
  group_ids: string[];
}

const readData = (payload: unknown): unknown => {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const candidate = payload as RawObject;
  if ('data' in candidate) {
    return candidate.data;
  }

  return payload;
};

const toGroupRows = (payload: unknown): GroupRow[] => {
  const source = readData(payload);
  const arrayValue = Array.isArray(source)
    ? source
    : source && typeof source === 'object'
      ? ['groups', 'items', 'rows', 'result']
          .map((key) => (source as RawObject)[key])
          .find((value) => Array.isArray(value))
      : null;

  if (!Array.isArray(arrayValue)) {
    return [];
  }

  return arrayValue
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const row = item as RawObject;
      const id = String(row.group_id ?? row.id ?? '');
      if (!id) {
        return null;
      }

      return {
        id,
        name: String(row.group_name ?? row.name ?? id),
        description: String(row.group_description ?? row.description ?? '')
      };
    })
    .filter((row): row is GroupRow => Boolean(row));
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item)).filter(Boolean);
};

const extractGroupIds = (row: RawObject): string[] => {
  const directIds = toStringArray(row.group_ids);
  const singleId = String(row.group_id ?? '');
  const groupsArray = Array.isArray(row.groups) ? row.groups : [];
  const nestedGroupIds = groupsArray
    .map((group) => {
      if (!group || typeof group !== 'object') {
        return '';
      }

      const g = group as RawObject;
      return String(g.group_id ?? g.id ?? '');
    })
    .filter(Boolean);
  const groupRoles = row.group_roles;
  const groupRoleKeys =
    groupRoles && typeof groupRoles === 'object' ? Object.keys(groupRoles as Record<string, unknown>) : [];

  return Array.from(
    new Set([
      ...directIds,
      ...(singleId ? [singleId] : []),
      ...nestedGroupIds,
      ...groupRoleKeys
    ])
  );
};

const toUsers = (payload: unknown): UserRow[] => {
  const source = readData(payload);
  const arrayValue = Array.isArray(source)
    ? source
    : source && typeof source === 'object'
      ? ['users', 'items', 'rows', 'result', 'members']
          .map((key) => (source as RawObject)[key])
          .find((value) => Array.isArray(value))
      : null;

  if (!Array.isArray(arrayValue)) {
    return [];
  }

  return arrayValue
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const row = item as RawObject;
      const id = String(row.user_id ?? row.id ?? '');
      if (!id) {
        return null;
      }

      return {
        id,
        username: String(row.username ?? ''),
        email: String(row.email ?? ''),
        full_name: String(row.full_name ?? row.fullname ?? ''),
        group_ids: extractGroupIds(row)
      };
    })
    .filter((row): row is UserRow => Boolean(row));
};

const defaultForm: GroupFormState = {
  name: '',
  description: ''
};

export default function AdminGroupsManager() {
  const t = useTranslations('admin');
  const {systemPermissions, isSystemPermissionsLoaded} = usePermissionStore();
  const [rows, setRows] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<GroupFormState>(defaultForm);
  const [deleteTarget, setDeleteTarget] = useState<GroupRow | null>(null);
  const [memberModalGroup, setMemberModalGroup] = useState<GroupRow | null>(null);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberActionLoading, setMemberActionLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [memberTab, setMemberTab] = useState<'members' | 'add'>('members');

  const canAddMember =
    isSystemPermissionsLoaded &&
    hasPermissionRequirement(systemPermissions, {anyOf: ['group.create.add.usertogroup']});
  const canRemoveMember =
    isSystemPermissionsLoaded &&
    hasPermissionRequirement(systemPermissions, {anyOf: ['group.delete.remove.userfromgroup']});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getAllGroups();
      setRows(toGroupRows(response.data));
    } catch {
      toast.error(t('load_error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMembersContext = useCallback(
    async (group: GroupRow) => {
      setMemberLoading(true);

      try {
        const usersRes = await getAdminUsers();
        const users = toUsers(usersRes.data);
        setAllUsers(users);
      } catch {
        toast.error(t('load_members_error'));
      } finally {
        setMemberLoading(false);
      }
    },
    [t]
  );

  const columns = useMemo(
    () => [
      {key: 'name' as const, label: t('columns.group_name')},
      {key: 'description' as const, label: t('columns.description')},
      {
        key: 'id' as const,
        label: t('columns.actions'),
        render: (_: string, row: GroupRow) => (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setForm({id: row.id, name: row.name, description: row.description});
                setOpenForm(true);
              }}
            >
              {t('edit')}
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                setMemberModalGroup(row);
                setMemberTab('members');
                await loadMembersContext(row);
              }}
            >
              {t('manage_members')}
            </Button>
            <Button variant="danger" onClick={() => setDeleteTarget(row)}>
              {t('delete')}
            </Button>
          </div>
        )
      }
    ],
    [t, loadMembersContext]
  );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!form.name.trim()) {
      return;
    }

    try {
      setSaving(true);
      if (form.id) {
        await modifyGroupBase({
          group_id: form.id,
          name: form.name,
          description: form.description || undefined
        });
      } else {
        await createGroup({
          name: form.name,
          description: form.description || undefined
        });
      }

      toast.success(t('save_success'));
      setOpenForm(false);
      setForm(defaultForm);
      await load();
    } catch {
      toast.error(t('save_error'));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      setDeleting(true);
      await deleteGroup(deleteTarget.id);
      toast.success(t('delete_success'));
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error(t('delete_error'));
    } finally {
      setDeleting(false);
    }
  };

  const groupMembers = useMemo(() => {
    if (!memberModalGroup) {
      return [];
    }

    return allUsers.filter((user) => user.group_ids.includes(memberModalGroup.id));
  }, [allUsers, memberModalGroup]);

  const availableUsers = useMemo(() => {
    if (!memberModalGroup) {
      return [];
    }

    return allUsers.filter((user) => !user.group_ids.includes(memberModalGroup.id));
  }, [allUsers, memberModalGroup]);

  const onAddMember = useCallback(async (userId: string) => {
    if (!memberModalGroup || !userId) {
      return;
    }

    try {
      setMemberActionLoading(true);
      await addUserToGroup(memberModalGroup.id, userId);
      setAllUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? {
                ...user,
                group_ids: user.group_ids.includes(memberModalGroup.id)
                  ? user.group_ids
                  : [...user.group_ids, memberModalGroup.id]
              }
            : user
        )
      );
      toast.success(t('add_member_success'));
    } catch {
      toast.error(t('add_member_error'));
    } finally {
      setMemberActionLoading(false);
    }
  }, [memberModalGroup, t]);

  const onRemoveMember = useCallback(async (userId: string) => {
    if (!memberModalGroup) {
      return;
    }

    try {
      setMemberActionLoading(true);
      await removeUserFromGroup(memberModalGroup.id, userId);
      setAllUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? {
                ...user,
                group_ids: user.group_ids.filter((groupId) => groupId !== memberModalGroup.id)
              }
            : user
        )
      );
      toast.success(t('remove_member_success'));
    } catch {
      toast.error(t('remove_member_error'));
    } finally {
      setMemberActionLoading(false);
    }
  }, [memberModalGroup, t]);

  const memberColumns = useMemo(
    () => [
      {key: 'full_name' as const, label: t('columns.full_name')},
      {key: 'email' as const, label: t('columns.email')},
      {
        key: 'id' as const,
        label: t('columns.actions'),
        render: (_: string, row: UserRow) => (
          <Button variant="danger" disabled={memberActionLoading || !canRemoveMember} onClick={() => onRemoveMember(row.id)}>
            {t('remove_member')}
          </Button>
        )
      }
    ],
    [t, memberActionLoading, canRemoveMember, onRemoveMember]
  );

  const addColumns = useMemo(
    () => [
      {key: 'full_name' as const, label: t('columns.full_name')},
      {key: 'email' as const, label: t('columns.email')},
      {
        key: 'id' as const,
        label: t('columns.actions'),
        render: (_: string, row: UserRow) => (
          <Button disabled={memberActionLoading || !canAddMember} onClick={() => onAddMember(row.id)}>
            {t('add_member')}
          </Button>
        )
      }
    ],
    [t, memberActionLoading, canAddMember, onAddMember]
  );

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setForm(defaultForm);
            setOpenForm(true);
          }}
        >
          {t('create_group')}
        </Button>
      </div>

      <DataTable columns={columns} rows={rows} />

      <Modal
        open={openForm}
        title={form.id ? t('edit_group_title') : t('create_group_title')}
        onClose={() => setOpenForm(false)}
      >
        <form className="space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm text-slate-300">{t('columns.group_name')}</label>
            <input
              className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
              value={form.name}
              onChange={(event) => setForm((prev) => ({...prev, name: event.target.value}))}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">{t('columns.description')}</label>
            <textarea
              className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
              value={form.description}
              onChange={(event) => setForm((prev) => ({...prev, description: event.target.value}))}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setOpenForm(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t('saving') : t('save')}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('delete_group_title')}
        message={t('delete_group_confirm')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={onDelete}
      />

      <Modal
        open={Boolean(memberModalGroup)}
        title={
          memberModalGroup ? `${t('manage_members_title')}: ${memberModalGroup.name}` : t('manage_members_title')
        }
        onClose={() => setMemberModalGroup(null)}
      >
        {memberLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant={memberTab === 'members' ? 'primary' : 'ghost'} onClick={() => setMemberTab('members')}>
                {t('members_tab')}
              </Button>
              <Button variant={memberTab === 'add' ? 'primary' : 'ghost'} onClick={() => setMemberTab('add')}>
                {t('add_tab')}
              </Button>
            </div>

            <div>
              {memberTab === 'members' ? (
                <>
                  <p className="mb-2 text-sm font-medium text-slate-200">{t('group_members_current')}</p>
                  {groupMembers.length === 0 ? (
                    <p className="text-sm text-slate-400">{t('no_members')}</p>
                  ) : (
                    <DataTable columns={memberColumns} rows={groupMembers} />
                  )}
                </>
              ) : (
                <>
                  <p className="mb-2 text-sm font-medium text-slate-200">{t('add_member')}</p>
                  {availableUsers.length === 0 ? (
                    <p className="text-sm text-slate-400">{t('no_available_users')}</p>
                  ) : (
                    <DataTable columns={addColumns} rows={availableUsers} />
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {deleting && <div className="hidden" aria-hidden="true" />}
    </div>
  );
}
