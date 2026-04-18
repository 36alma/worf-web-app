'use client';

import {useGroupPermission} from '@/components/providers/GroupPermissionContext';

/**
 * Group detail page.
 * Uses the GroupPermissionContext to access the clean groupId.
 * Silent Policy: while loading, shows skeleton; if no permissions, shows empty state.
 */
export default function GroupDetailPage() {
  const {groupId, isLoading} = useGroupPermission();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
        <div className="h-32 w-full animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="display-font text-2xl font-semibold text-[var(--text-primary)]">
        Csoport
      </h1>
      <div className="surface rounded-xl p-4 text-sm text-[var(--text-secondary)]">
        Group ID: {groupId}
      </div>
    </section>
  );
}
