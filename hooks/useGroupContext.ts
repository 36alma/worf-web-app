'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import type {GroupUser, Sprint} from '@/components/groups/tasks/types';
import {getGroupMembers} from '@/lib/api/groups';
import {getGroupPermissions, type PermissionMap} from '@/lib/api/permissions';
import {getSprintList} from '@/lib/api/sprints';
import {parseGroupUsers} from '@/lib/utils/groupUsers';

export interface GroupContextOptions {
  /** Also load the group's members (the assignee picker). Default `true`. */
  users?: boolean;
  /** Also load the group's sprints (needs `group.sprint.read`). Default `true`. */
  sprints?: boolean;
}

export interface GroupContextState {
  /** True from the moment `groupId` is set until its permission map has arrived (or failed). */
  loading: boolean;
  permissions: PermissionMap;
  hasPermission: (name: string) => boolean;
  groupUsers: GroupUser[];
  groupUsersLoading: boolean;
  sprints: Sprint[];
}

interface Loaded {
  groupId: string;
  /** `null` while the request is in flight. */
  permissions: PermissionMap | null;
  users: GroupUser[] | null;
  sprints: Sprint[];
}

const NO_PERMISSIONS: PermissionMap = {};

/**
 * What the group pages get from their route (`GroupPermissionContext`, the members and sprint fetches), loaded on
 * demand for whichever group the dashboard needs to open a modal for. Nothing runs while `groupId` is null.
 *
 * Group ids are encrypted afresh on every response, so nothing is cached across ids: it reloads when the id string
 * changes, which is once per opened item — never on a dashboard refetch.
 *
 * The loading flags derive from `groupId` rather than from effect-set state, so the very first render for a new id
 * already reports "loading" — a modal gated on it never flashes open with empty permissions.
 */
export function useGroupContext(
  groupId: string | null,
  {users: withUsers = true, sprints: withSprints = true}: GroupContextOptions = {}
): GroupContextState {
  const [data, setData] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!groupId) {
      setData(null);
      return;
    }

    let alive = true;
    const update = (patch: Partial<Loaded>) =>
      setData((prev) => (alive && prev?.groupId === groupId ? {...prev, ...patch} : prev));

    setData({groupId, permissions: null, users: withUsers ? null : [], sprints: []});

    if (withUsers) {
      getGroupMembers(groupId)
        .then((response) => update({users: parseGroupUsers(response)}))
        .catch(() => update({users: []})); // non-critical: the assignee picker just stays empty
    }

    getGroupPermissions(groupId)
      .catch((): PermissionMap => ({})) // silent policy: no permissions means a read-only modal
      .then(async (permissions) => {
        update({permissions});
        if (!withSprints || !permissions['group.sprint.read']) return;
        try {
          const response = await getSprintList({group_id: groupId, limit: 200});
          const payload = response.data?.data || response.data || [];
          const list = Array.isArray(payload.sprints) ? payload.sprints : Array.isArray(payload) ? payload : [];
          update({sprints: list});
        } catch {
          // non-critical: the sprint picker just stays empty
        }
      });

    return () => {
      alive = false;
    };
  }, [groupId, withUsers, withSprints]);

  const current = groupId && data?.groupId === groupId ? data : null;
  const permissions = current?.permissions ?? NO_PERMISSIONS;
  const hasPermission = useCallback((name: string) => permissions[name] === true, [permissions]);

  return useMemo(
    () => ({
      loading: !!groupId && (current === null || current.permissions === null),
      permissions,
      hasPermission,
      groupUsers: current?.users ?? [],
      groupUsersLoading: !!groupId && (current === null || current.users === null),
      sprints: current?.sprints ?? []
    }),
    [groupId, current, permissions, hasPermission]
  );
}
