'use client';

import {use} from 'react';
import {useGroupPermission} from '@/components/providers/GroupPermissionContext';
import MinutesDetailClient from '@/components/groups/minutes/MinutesDetailClient';

export default function MinutesDetailPage({
  params
}: {
  params: Promise<{groupId: string; minutesId: string; locale: string}>;
}) {
  const {isLoading, hasPermission} = useGroupPermission();
  const unwrappedParams = use(params);
  const decodedGroupId = decodeURIComponent(unwrappedParams.groupId);
  const decodedMinutesId = decodeURIComponent(unwrappedParams.minutesId);

  if (isLoading) return null;
  if (!hasPermission('group.minutes.read')) return null;

  return (
    <MinutesDetailClient
      groupId={decodedGroupId}
      minutesId={decodedMinutesId}
      permissions={{
        modify: hasPermission('group.minutes.modify'),
        finalize: hasPermission('group.minutes.finalize'),
        approve: hasPermission('group.minutes.approve'),
        attachmentManage: hasPermission('group.minutes.attachment.manage')
      }}
    />
  );
}
