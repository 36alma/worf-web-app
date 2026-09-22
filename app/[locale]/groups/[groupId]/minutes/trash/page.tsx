'use client';

import {use} from 'react';
import {useGroupPermission} from '@/components/providers/GroupPermissionContext';
import MinutesTrashClient from '@/components/groups/minutes/MinutesTrashClient';

export default function MinutesTrashPage({params}: {params: Promise<{groupId: string; locale: string}>}) {
  const {isLoading, hasPermission} = useGroupPermission();
  const unwrappedParams = use(params);
  const decodedGroupId = decodeURIComponent(unwrappedParams.groupId);

  if (isLoading) return null;
  // The trash (list + restore) is tied to the delete permission: whoever may delete may also restore.
  if (!hasPermission('group.minutes.delete')) return null;

  return <MinutesTrashClient groupId={decodedGroupId} />;
}
