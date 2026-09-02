'use client';

import {ReactNode, useEffect} from 'react';
import {useLocale} from 'next-intl';
import {useParams, usePathname, useRouter} from 'next/navigation';
import {getGroupPermissions} from '@/lib/api/permissions';
import {normalizeGroupId} from '@/lib/utils/groupId';
import {
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
  const params = useParams<{groupId?: string}>();
  const locale = useLocale();
  const router = useRouter();
  // Public routes: /auth/* (login/register flows) and /{locale}/shared/*
  // (the unauthenticated share-link landing page, Task 33) skip Header/
  // Sidebar chrome and the permission-guard effects below, which assume a
  // logged-in user's data. Anchored (not a bare substring check) so a
  // hypothetical future route that merely *contains* "/shared/" somewhere
  // in its path can't silently and unintentionally lose both the chrome AND
  // the system-permission redirect guard below. '/{locale}/shared/' does
  // not match '/files/shared-with-me' (Task 23), which has a hyphen after
  // "shared", not a slash.
  const isPublicRoute = pathname.includes('/auth/') || /^\/[^/]+\/shared\//.test(pathname);
  const {
    systemPermissions,
    isSystemPermissionsLoaded,
    groupPermissionsById,
    groupPermissionsStatusById,
    setGroupPermissions,
    setGroupPermissionsLoading,
    setGroupPermissionsError
  } = usePermissionStore();

  const segments = pathname.split('/').filter(Boolean).slice(1);
  const topLevelSegment = segments[0] ?? '';
  const groupId = topLevelSegment === 'groups' && typeof params.groupId === 'string' ? normalizeGroupId(params.groupId) : '';

  const systemRequirement = systemRoutePermissionRequirements[topLevelSegment] ?? null;

  // ── System-level route guard ───────────────────────────────────────
  // Only redirects for system-level permission failures (e.g., admin).
  // GROUP_ONLY routes (calendar, tasks) without a groupId → dashboard.
  useEffect(() => {
    if (isPublicRoute || !isSystemPermissionsLoaded) return;
    if (systemRequirement === 'GROUP_ONLY' && !groupId) {
      router.replace(`/${locale}/dashboard`);
      return;
    }
    if (
      systemRequirement &&
      systemRequirement !== 'GROUP_ONLY' &&
      !hasPermissionRequirement(systemPermissions, systemRequirement)
    ) {
      router.replace(`/${locale}/dashboard`);
    }
  }, [isPublicRoute, isSystemPermissionsLoaded, systemRequirement, systemPermissions, router, locale, groupId]);

  // ── Bootstrap group permissions into the store ─────────────────────
  // This feeds the Sidebar's permission-based nav filtering.
  // It does NOT trigger any redirects on failure.
  useEffect(() => {
    if (isPublicRoute || !groupId) return;
    const status = groupPermissionsStatusById[groupId];
    if (status === 'loading' || status === 'loaded' || status === 'error') return;

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
          setGroupPermissionsError(groupId);
        }
      }
    };

    void bootstrapGroupPermissions();

    return () => {
      mounted = false;
    };
  }, [
    isPublicRoute,
    groupId,
    groupPermissionsStatusById,
    setGroupPermissions,
    setGroupPermissionsError,
    setGroupPermissionsLoading
  ]);

  // ── NOTE: NO group sub-route redirect ──────────────────────────────
  // Previously, this component would redirect to /groups/{groupId} when
  // a group sub-route permission (e.g., calendar, tasks) was denied.
  // This caused redirect loops because:
  //   1. AppShell redirects to /groups/{id}
  //   2. Sidebar checks if group exists, may redirect to /groups
  //   3. Page re-renders, AppShell fires again → loop
  //
  // The fix: each page (calendar/page.tsx, tasks/page.tsx) handles its
  // own permission check via GroupPermissionContext and returns null
  // (Silent Policy) when access is denied. No redirect needed.

  if (isPublicRoute) {
    return <main id="main-content" className="min-h-screen p-4 md:p-8">{children}</main>;
  }

  const mustWaitForSystemPermission = Boolean(systemRequirement) && !isSystemPermissionsLoaded;
  const isBlockedBySystemPermission =
    systemRequirement !== null &&
    systemRequirement !== 'GROUP_ONLY' &&
    isSystemPermissionsLoaded &&
    !hasPermissionRequirement(systemPermissions, systemRequirement);

  return (
    <div className="min-h-screen bg-[var(--bg-root)]">
      <Header />
      <Sidebar />
      <main
        id="main-content"
        className="main-content page-content"
      >
        {mustWaitForSystemPermission || isBlockedBySystemPermission ? null : children}
      </main>
    </div>
  );
}
