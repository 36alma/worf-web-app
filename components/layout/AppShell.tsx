'use client';

import {ReactNode, useEffect} from 'react';
import {useLocale} from 'next-intl';
import {usePathname, useRouter} from 'next/navigation';
import {getGroupPermissions} from '@/lib/api/permissions';
import {
  groupRoutePermissionRequirements,
  hasPermissionRequirement,
  systemRoutePermissionRequirements
} from '@/lib/permissions/access';
import {usePermissionStore} from '@/lib/store/permissionStore';
import Header from './Header';
import Sidebar from './Sidebar';

export interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({children}: AppShellProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const isAuthRoute = pathname.includes('/auth/');
  const {
    systemPermissions,
    isSystemPermissionsLoaded,
    groupPermissionsById,
    groupPermissionsLoadingById,
    setGroupPermissions,
    setGroupPermissionsLoading
  } = usePermissionStore();

  const segments = pathname.split('/').filter(Boolean).slice(1);
  const topLevelSegment = segments[0] ?? '';
  const groupId = topLevelSegment === 'groups' ? segments[1] ?? '' : '';
  const groupSubSegment = topLevelSegment === 'groups' ? segments[2] ?? '' : '';

  const systemRequirement = systemRoutePermissionRequirements[topLevelSegment] ?? null;
  const groupRequirement = groupRoutePermissionRequirements[groupSubSegment] ?? null;
  const groupPermissions = groupId ? groupPermissionsById[groupId] : null;

  useEffect(() => {
    if (isAuthRoute || !isSystemPermissionsLoaded) return;
    if (systemRequirement && !hasPermissionRequirement(systemPermissions, systemRequirement)) {
      router.replace(`/${locale}/dashboard`);
    }
  }, [isAuthRoute, isSystemPermissionsLoaded, systemRequirement, systemPermissions, router, locale]);

  useEffect(() => {
    if (isAuthRoute || !groupId) return;
    if (groupPermissionsById[groupId] || groupPermissionsLoadingById[groupId]) return;

    let mounted = true;

    const bootstrapGroupPermissions = async () => {
      setGroupPermissionsLoading(groupId, true);
      try {
        const permissions = await getGroupPermissions(groupId);
        if (mounted) {
          setGroupPermissions(groupId, permissions);
        }
      } catch {
        if (mounted) {
          setGroupPermissions(groupId, {});
        }
      }
    };

    void bootstrapGroupPermissions();

    return () => {
      mounted = false;
    };
  }, [
    isAuthRoute,
    groupId,
    groupPermissionsById,
    groupPermissionsLoadingById,
    setGroupPermissions,
    setGroupPermissionsLoading
  ]);

  useEffect(() => {
    if (isAuthRoute || !groupId) return;
    if (!groupPermissions) return;
    if (groupRequirement && !hasPermissionRequirement(groupPermissions, groupRequirement)) {
      router.replace(`/${locale}/groups/${groupId}`);
    }
  }, [isAuthRoute, groupId, groupPermissions, groupRequirement, router, locale]);

  if (isAuthRoute) {
    return <main id="main-content" className="min-h-screen p-4 md:p-8">{children}</main>;
  }

  const mustWaitForSystemPermission = Boolean(systemRequirement) && !isSystemPermissionsLoaded;
  const isBlockedBySystemPermission =
    Boolean(systemRequirement) &&
    isSystemPermissionsLoaded &&
    !hasPermissionRequirement(systemPermissions, systemRequirement);
  const mustWaitForGroupPermission = Boolean(groupRequirement && groupId && !groupPermissions);
  const isBlockedByGroupPermission =
    Boolean(groupRequirement && groupPermissions) &&
    !hasPermissionRequirement(groupPermissions as Record<string, boolean>, groupRequirement);

  return (
    <div className="min-h-screen bg-[var(--bg-root)]">
      <Header />
      <Sidebar />
      <main
        id="main-content"
        className="main-content page-content"
      >
        {mustWaitForSystemPermission || isBlockedBySystemPermission || mustWaitForGroupPermission || isBlockedByGroupPermission ? null : children}
      </main>
    </div>
  );
}
