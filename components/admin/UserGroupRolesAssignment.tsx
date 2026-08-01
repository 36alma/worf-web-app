'use client';

import {useCallback, useEffect, useState} from 'react';
import {Users} from 'lucide-react';
import toast from 'react-hot-toast';
import {useTranslations} from 'next-intl';
import {
  addUserToGroup,
  getGroupRoles,
  removeUserFromGroup,
  setGroupMemberRole
} from '@/lib/api/groups';
import {getAdminGroupMembers, getAdminUserProfile, getAdminUsersNotInGroup} from '@/lib/api/admin';
import {hasPermissionRequirement} from '@/lib/permissions/access';
import {usePermissionStore} from '@/lib/store/permissionStore';
import Button from '@/components/ui/Button';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import Skeleton from '@/components/ui/Skeleton';
import GroupRolePickerModal from '@/components/groups/GroupRolePickerModal';

type Raw = Record<string, unknown>;

type UserRow = {
  user_id: string;
  full_name: string;
  email: string;
  username: string;
  group_role_id?: string;
};
const PAGE_SIZE = 20;

const pickArray = (input: unknown): unknown[] => {
  if (Array.isArray(input)) return input;
  if (!input || typeof input !== 'object') return [];
  const src = input as Raw;
  const direct = 'data' in src ? (src.data as unknown) : input;
  if (Array.isArray(direct)) return direct;
  if (!direct || typeof direct !== 'object') return [];
  const obj = direct as Raw;
  const keys = ['users', 'group_users', 'items', 'rows', 'result', 'group_roles', 'roles'];
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) return v;
  }
  return [];
};

const toUsers = (payload: unknown): UserRow[] =>
  pickArray(payload)
    .map((item): UserRow | null => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Raw;
      const user_id = typeof row.user_id === 'string' ? row.user_id.trim() : String(row.user_id ?? '').trim();
      if (!user_id) return null;
      const email = String(row.email ?? '');
      return {
        user_id,
        full_name: String(row.full_name ?? row.fullname ?? row.name ?? email),
        email,
        username: String(row.username ?? email.split('@')[0] ?? ''),
        group_role_id: row.group_role_id ? String(row.group_role_id) : undefined
      };
    })
    .filter((u): u is UserRow => u !== null);

const toRoles = (payload: unknown): {group_role_id: string; group_role_name: string}[] =>
  pickArray(payload)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Raw;
      const group_role_id = String(row.group_role_id ?? row.id ?? '');
      if (!group_role_id) return null;
      return {group_role_id, group_role_name: String(row.group_role_name ?? row.name ?? group_role_id)};
    })
    .filter((r): r is {group_role_id: string; group_role_name: string} => Boolean(r));

export default function UserGroupRolesAssignment({groupId}: {groupId: string}) {
  const t = useTranslations('admin.userGroupRoles');
  const a = useTranslations('admin');
  const {systemPermissions, isSystemPermissionsLoaded} = usePermissionStore();

  const canAddMember =
    isSystemPermissionsLoaded && hasPermissionRequirement(systemPermissions, {anyOf: ['group.create.add.usertogroup']});
  const canRemoveMember =
    isSystemPermissionsLoaded &&
    hasPermissionRequirement(systemPermissions, {anyOf: ['group.delete.remove.userfromgroup']});
  const canManageRoles =
    isSystemPermissionsLoaded && hasPermissionRequirement(systemPermissions, {anyOf: ['group.admin.role.management']});

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<UserRow[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserRow[]>([]);
  const [availableUsersLoading, setAvailableUsersLoading] = useState(false);
  const [availableUsersPage, setAvailableUsersPage] = useState(1);
  const [availableUsersTotal, setAvailableUsersTotal] = useState(0);
  const [manageOpen, setManageOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [roleUser, setRoleUser] = useState<UserRow | null>(null);
  const [roles, setRoles] = useState<{group_role_id: string; group_role_name: string}[]>([]);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState({full_name: '', email: '', username: ''});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, rolesRes] = await Promise.all([getAdminGroupMembers(groupId), getGroupRoles(groupId)]);
      setMembers(toUsers(membersRes.data));
      setRoles(toRoles(rolesRes.data));
    } catch {
      toast.error(t('messages.loadError'));
    } finally {
      setLoading(false);
    }
  }, [groupId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadAvailableUsers = useCallback(
    async (pageNumber: number) => {
      setAvailableUsersLoading(true);
      try {
        const res = await getAdminUsersNotInGroup({
          group_id: groupId,
          page_number: pageNumber,
          load_user_number: PAGE_SIZE
        });

        const normalizedUsers = toUsers(res.users);
        const safeTotal = Number.isFinite(res.total) ? Math.max(0, res.total) : 0;
        const safePage = Number.isFinite(res.page_number) ? Math.max(1, res.page_number) : 1;

        if (safePage > 1 && normalizedUsers.length === 0 && safeTotal > 0) {
          await loadAvailableUsers(safePage - 1);
          return;
        }

        setAvailableUsers(normalizedUsers);
        setAvailableUsersTotal(safeTotal);
        setAvailableUsersPage(safePage);
      } catch {
        toast.error(a('load_members_error'));
      } finally {
        setAvailableUsersLoading(false);
      }
    },
    [a, groupId]
  );

  useEffect(() => {
    if (!manageOpen) return;
    void loadAvailableUsers(1);
  }, [loadAvailableUsers, manageOpen]);

  const onAdd = async (userId: string) => {
    try {
      setBusy(true);
      await addUserToGroup(groupId, userId);
      toast.success(a('add_member_success'));
      await load();
      await loadAvailableUsers(availableUsersPage);
    } catch {
      toast.error(a('add_member_error'));
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (userId: string) => {
    try {
      setBusy(true);
      await removeUserFromGroup(groupId, userId);
      toast.success(a('remove_member_success'));
      await load();
    } catch {
      toast.error(a('remove_member_error'));
    } finally {
      setBusy(false);
    }
  };

  const onSetRole = async (roleId: string | null) => {
    if (!roleUser) return;
    try {
      setBusy(true);
      await setGroupMemberRole({
        group_id: groupId,
        user_id: roleUser.user_id,
        current_group_role_id: roleUser.group_role_id ?? null,
        next_group_role_id: roleId
      });
      toast.success(a('set_role_success'));
      setRolePickerOpen(false);
      setRoleUser(null);
      await load();
    } catch {
      toast.error(a('set_role_error'));
    } finally {
      setBusy(false);
    }
  };

  const openEdit = async (user: UserRow) => {
    setEditingUser(user);
    try {
      const p = await getAdminUserProfile(user.user_id);
      setForm({
        full_name: String(p?.full_name ?? user.full_name),
        email: String(p?.email ?? user.email),
        username: String(p?.username ?? user.username)
      });
    } catch {
      setForm({full_name: user.full_name, email: user.email, username: user.username});
    }
  };

  const memberColumns = [
    {key: 'full_name' as const, label: a('columns.full_name')},
    {key: 'email' as const, label: a('columns.email')},
    {
      key: 'user_id' as const,
      label: a('columns.actions'),
      render: (_: unknown, row: UserRow) => (
        <div className="flex gap-2">
          {canManageRoles && (
            <Button
              className="p-2"
              variant="ghost"
              onClick={() => {
                setRoleUser(row);
                setRolePickerOpen(true);
              }}
            >
              {a('set_role')}
            </Button>
          )}
          <Button className="p-2" variant="ghost" onClick={() => openEdit(row)}>
            {a('edit')}
          </Button>
          <Button className="p-2" variant="danger" disabled={!canRemoveMember || busy} onClick={() => onRemove(row.user_id)}>
            {a('remove_member')}
          </Button>
        </div>
      )
    }
  ];

  const addColumns = [
    {key: 'full_name' as const, label: a('columns.full_name')},
    {key: 'email' as const, label: a('columns.email')},
    {
      key: 'user_id' as const,
      label: a('columns.actions'),
      render: (_: unknown, row: UserRow) => (
        <Button className="p-2" disabled={!canAddMember || busy} onClick={() => onAdd(row.user_id)}>
          {a('add_member')}
        </Button>
      )
    }
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          className="p-2"
          onClick={() => {
            setManageOpen(true);
          }}
        >
          {a('manage_members')}
        </Button>
      </div>

      <DataTable
        columns={memberColumns}
        rows={members}
        emptyState={
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bg-active)] text-[var(--text-tertiary)]">
              <Users size={26} strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--text-primary)]">No members yet</p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                Add members to this group so they can collaborate together.
              </p>
            </div>
            {canAddMember && (
              <Button className="mt-1 px-4 py-2 text-sm" onClick={() => setManageOpen(true)}>
                + Add member
              </Button>
            )}
          </div>
        }
      />

      <Modal
        open={manageOpen}
        title={a('manage_members_title')}
        badge={`${members.length} members`}
        onClose={() => setManageOpen(false)}
      >
        <div className="space-y-4">
          <DataTable
            columns={addColumns}
            rows={availableUsers}
            emptyState={
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Users size={32} strokeWidth={1.25} className="text-[var(--text-tertiary)]" />
                <p className="text-sm font-medium text-[var(--text-primary)]">No users available to add</p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  All users are already members of this group.
                </p>
              </div>
            }
          />
          {/* Pagination — Previous / page info centred / Next */}
          <div className="flex items-center justify-between pt-1">
            <Button
              className="px-3 py-1.5 text-sm"
              variant="ghost"
              disabled={busy || availableUsersLoading || availableUsersPage <= 1}
              onClick={() => void loadAvailableUsers(availableUsersPage - 1)}
            >
              ← Previous
            </Button>
            <span className="text-xs text-[var(--text-tertiary)]">
              Page {availableUsersPage} · {availableUsersTotal} total
            </span>
            <Button
              className="px-3 py-1.5 text-sm"
              variant="ghost"
              disabled={busy || availableUsersLoading || availableUsersPage * PAGE_SIZE >= availableUsersTotal}
              onClick={() => void loadAvailableUsers(availableUsersPage + 1)}
            >
              Next →
            </Button>
          </div>
        </div>
      </Modal>

      <GroupRolePickerModal
        open={rolePickerOpen}
        groupId={groupId}
        onClose={() => {
          setRolePickerOpen(false);
          setRoleUser(null);
        }}
        onSelect={onSetRole}
        currentRoleId={roleUser?.group_role_id}
      />

      <Modal open={Boolean(editingUser)} title={a('edit_user_title')} onClose={() => setEditingUser(null)}>
        <div className="space-y-4">
          <input
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
            value={form.full_name}
            onChange={(e) => setForm((p) => ({...p, full_name: e.target.value}))}
            readOnly
            placeholder={a('columns.full_name')}
          />
          <input
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
            value={form.email}
            onChange={(e) => setForm((p) => ({...p, email: e.target.value}))}
            readOnly
            placeholder="E-mail"
          />
          <input
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
            value={form.username}
            onChange={(e) => setForm((p) => ({...p, username: e.target.value}))}
            readOnly
            placeholder={a('columns.username')}
          />
          <div className="flex justify-end gap-2">
            <Button className="p-2" variant="ghost" onClick={() => setEditingUser(null)}>
              {a('cancel')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
