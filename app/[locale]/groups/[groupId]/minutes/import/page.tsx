'use client';

import {use} from 'react';
import {useGroupPermission} from '@/components/providers/GroupPermissionContext';
import MinutesImportWizard from '@/components/groups/minutes/MinutesImportWizard';

export default function MinutesImportPage({params}: {params: Promise<{groupId: string; locale: string}>}) {
  const {isLoading, hasPermission} = useGroupPermission();
  const unwrappedParams = use(params);
  const decodedGroupId = decodeURIComponent(unwrappedParams.groupId);

  if (isLoading) return null;
  if (!hasPermission('group.minutes.create')) return null;

  return <MinutesImportWizard groupId={decodedGroupId} />;
}
