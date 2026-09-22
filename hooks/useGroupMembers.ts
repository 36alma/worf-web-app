'use client';

import {useEffect, useState} from 'react';
import type {GroupUser} from '@/components/groups/tasks/types';
import {getGroupMembers} from '@/lib/api/groups';
import {parseGroupUsers} from '@/lib/utils/groupUsers';

/** The group's members (`user_id`, name, e-mail, username). Skips the request while `enabled` is false. */
export function useGroupMembers(groupId: string, enabled = true): GroupUser[] {
  const [members, setMembers] = useState<GroupUser[]>([]);

  useEffect(() => {
    if (!enabled || !groupId) return;
    let mounted = true;
    getGroupMembers(groupId)
      .then((res) => mounted && setMembers(parseGroupUsers(res.data)))
      .catch(() => mounted && setMembers([]));
    return () => {
      mounted = false;
    };
  }, [groupId, enabled]);

  return members;
}
