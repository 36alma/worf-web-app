'use client';

import {use} from 'react';
import {useGroupPermission} from '@/components/providers/GroupPermissionContext';
import MinutesListClient from '@/components/groups/minutes/MinutesListClient';

export default function GroupMinutesPage({params}: {params: Promise<{groupId: string; locale: string}>}) {
  const {isLoading, hasPermission} = useGroupPermission();
  const unwrappedParams = use(params);

  // KÖTELEZŐ: URL dekódolás az esetleges %3D miatt
  const decodedGroupId = decodeURIComponent(unwrappedParams.groupId);

  // ── Skeleton while loading permissions ─────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
        <div className="h-40 w-full animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
      </div>
    );
  }

  // ── Silent Policy: no read permission → blank screen ───────────────
  if (!hasPermission('group.minutes.read')) {
    return null;
  }

  return (
    <MinutesListClient
      groupId={decodedGroupId}
      permissions={{create: hasPermission('group.minutes.create')}}
    />
  );
}
