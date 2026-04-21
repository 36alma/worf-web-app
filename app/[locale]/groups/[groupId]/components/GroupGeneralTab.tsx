'use client';

import { useGroupPermission } from '@/components/providers/GroupPermissionContext';

export function GroupGeneralTab() {
  const { groupId } = useGroupPermission();

  return (
    <div className="space-y-4">
      <div className="surface rounded-xl p-6 text-sm text-[var(--text-secondary)]">
        <h2 className="text-lg font-medium text-[var(--text-primary)] mb-2">Általános Információk</h2>
        <p>Csoport azonosító (ID): <span className="font-mono bg-[var(--bg-elevated)] px-2 py-0.5 rounded text-[var(--text-primary)]">{groupId}</span></p>
        <p className="mt-4 opacity-75">Később itt szerkeszthető a csoport neve és leírása, illetve innen indítható a csoport törlése is.</p>
      </div>
    </div>
  );
}
