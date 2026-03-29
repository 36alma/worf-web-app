'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import {useLocale, useTranslations} from 'next-intl';
import {usePathname, useRouter} from 'next/navigation';
import {
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  StickyNote,
  UserCircle,
  Users
} from 'lucide-react';
import {logout} from '@/lib/api/auth';
import {getUserGroups} from '@/lib/api/groups';
import {getGroupPermissions} from '@/lib/api/permissions';
import {hasPermissionRequirement, navPermissionRequirements, type NavKey} from '@/lib/permissions/access';
import {usePermissionStore} from '@/lib/store/permissionStore';
import {useUiStore} from '@/lib/store/uiStore';
import type {ElementType} from 'react';

const navIcons: Record<NavKey, ElementType> = {
  dashboard: LayoutDashboard,
  groups: Users,
  tasks: ClipboardList,
  calendar: CalendarDays,
  posts: StickyNote,
  admin: Shield,
  profile: UserCircle
};

const navKeys: NavKey[] = ['dashboard', 'groups', 'tasks', 'calendar', 'posts', 'admin'];

const selectedGroupNavPermissions: Partial<Record<NavKey, string[]>> = {
  tasks: ['group.task.read'],
  calendar: ['group.calendar.read', 'group.calendar.write'],
  posts: ['group.post.read']
};

interface SidebarGroup {
  id: string;
  name: string;
}

const normalizeGroups = (payload: unknown): SidebarGroup[] => {
  console.log('[Sidebar] Raw payload received:', payload);
  
  if (!payload) return [];

  let data = payload;
  
  if (typeof payload === 'string') {
    try {
      data = JSON.parse(payload);
    } catch {
      return [];
    }
  }

  const results: SidebarGroup[] = [];
  
  const traverse = (item: any) => {
    if (!item || typeof item === 'function') return;

    if (Array.isArray(item)) {
      item.forEach(traverse);
      return;
    }

    if (typeof item === 'object') {
      const keys = Object.keys(item);
      const idKey = keys.find(k => k.toLowerCase().endsWith('id') || k.toLowerCase() === 'id');
      const id = idKey ? item[idKey] : null;
      const nameKey = keys.find(k => k.toLowerCase().includes('name') || k.toLowerCase() === 'title');
      const name = nameKey ? item[nameKey] : null;

      if (id && id !== 'undefined' && id !== 'null') {
        results.push({
          id: String(id),
          name: String(name || id)
        });
        return; 
      }

      Object.values(item).forEach(traverse);
    }
  };

  traverse(data);

  const uniqueResults = results.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
  console.log('[Sidebar] Final normalized groups:', uniqueResults);
  return uniqueResults;
};

export default function Sidebar() {
  const t = useTranslations('nav');
  const authT = useTranslations('auth');
  const commonT = useTranslations('common');
  const groupsT = useTranslations('groups');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const {mobileSidebarOpen, toggleSidebar, setSidebarOpen, selectedGroupId, setSelectedGroupId} = useUiStore();
  const {
    systemPermissions,
    isSystemPermissionsLoaded,
    groupPermissionsById,
    groupPermissionsLoadingById,
    setGroupPermissions,
    setGroupPermissionsLoading,
    clearPermissions
  } = usePermissionStore();
  const [groups, setGroups] = useState<SidebarGroup[]>([]);
  const [isGroupsLoaded, setIsGroupsLoaded] = useState(false);
  const {pathGroupId, pathGroupSubSegment} = useMemo(() => {
    const match = pathname.match(new RegExp(`^/${locale}/groups/([^/]+)(?:/([^/]+))?`));
    return {
      pathGroupId: match?.[1] ?? '',
      pathGroupSubSegment: match?.[2] ?? ''
    };
  }, [pathname, locale]);

  const loadGroups = useCallback(async () => {
    try {
      const response = await getUserGroups();
      const groupList = normalizeGroups(response?.data);
      setGroups(groupList);
    } catch {
      setGroups([]);
    } finally {
      setIsGroupsLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups, pathname]);

  useEffect(() => {
    const onFocus = () => {
      void loadGroups();
    };

    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [loadGroups]);

  useEffect(() => {
    if (pathGroupId && pathGroupId !== selectedGroupId) {
      setSelectedGroupId(pathGroupId);
    }
  }, [pathGroupId, selectedGroupId, setSelectedGroupId]);

  useEffect(() => {
    if (pathGroupId) {
      return;
    }

    if (groups.length === 0) {
      if (selectedGroupId !== '') {
        setSelectedGroupId('');
      }
      return;
    }

    const exists = groups.some((group) => group.id === selectedGroupId);
    if (selectedGroupId && !exists) {
      setSelectedGroupId('');
    }
  }, [groups, pathGroupId, selectedGroupId, setSelectedGroupId]);

  useEffect(() => {
    let mounted = true;

    const loadMissingGroupPermissions = async () => {
      const missingGroupIds = groups
        .map((group) => group.id)
        .filter((groupId) => !groupPermissionsById[groupId] && !groupPermissionsLoadingById[groupId]);

      if (missingGroupIds.length === 0) {
        return;
      }

      await Promise.all(
        missingGroupIds.map(async (groupId) => {
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
        })
      );
    };

    loadMissingGroupPermissions();

    return () => {
      mounted = false;
    };
  }, [
    groups,
    groupPermissionsById,
    groupPermissionsLoadingById,
    setGroupPermissions,
    setGroupPermissionsLoading
  ]);

  const allGroupIds = useMemo(() => groups.map((group) => group.id), [groups]);
  const selectedGroupPermissions = selectedGroupId ? groupPermissionsById[selectedGroupId] : null;
  const isSelectedGroupPermissionsLoaded = selectedGroupId ? Boolean(selectedGroupPermissions) : true;
  const areAllGroupPermissionsLoaded = useMemo(() => {
    if (allGroupIds.length === 0) {
      return true;
    }

    return allGroupIds.every((groupId) => Boolean(groupPermissionsById[groupId]));
  }, [allGroupIds, groupPermissionsById]);

  const hasAnyGroupPermission = useCallback(
    (permissions: string[]) => {
      if (allGroupIds.length === 0) {
        return false;
      }

      return allGroupIds.some((groupId) => {
        const groupPermissions = groupPermissionsById[groupId];
        if (!groupPermissions) {
          return false;
        }

        return permissions.some((permission) => groupPermissions[permission]);
      });
    },
    [allGroupIds, groupPermissionsById]
  );

  const canOpenGroups = useMemo(() => {
    const requirement = navPermissionRequirements.groups;
    if (!requirement) {
      return true;
    }

    if (!isSystemPermissionsLoaded) {
      return false;
    }

    return hasPermissionRequirement(systemPermissions, requirement);
  }, [systemPermissions, isSystemPermissionsLoaded]);

  const handleGroupSelect = (groupId: string) => {
    setSelectedGroupId(groupId);
    if (!groupId) {
      if (pathGroupSubSegment === 'calendar') {
        router.push(`/${locale}/calendar`);
        return;
      }

      if (pathGroupSubSegment === 'posts') {
        router.push(`/${locale}/posts`);
        return;
      }

      router.push(`/${locale}/groups`);
      return;
    }

    router.push(`/${locale}/groups/${groupId}`);
  };

  const resolveHref = (key: NavKey) => {
    if (!selectedGroupId) {
      return `/${locale}/${key}`;
    }

    if (key === 'groups') {
      return `/${locale}/groups/${selectedGroupId}`;
    }

    if (key === 'calendar') {
      return `/${locale}/groups/${selectedGroupId}/calendar`;
    }

    if (key === 'posts') {
      return `/${locale}/groups/${selectedGroupId}/posts`;
    }

    return `/${locale}/${key}`;
  };

  const handleLogout = async () => {
    await logout();
    clearPermissions();
    window.location.href = `/${locale}/auth/login`;
  };

  return (
    <>
      <button
        type="button"
        className="fixed left-4 top-4 z-50 rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 md:hidden"
        onClick={toggleSidebar}
      >
        <Menu size={16} />
      </button>

      <div
        className={`fixed inset-0 z-30 bg-black/60 md:hidden ${mobileSidebarOpen ? 'block' : 'hidden'}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={`fixed z-40 h-full w-60 border-r border-[var(--border)] bg-[var(--surface)] p-4 transition-transform md:translate-x-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-3 display-font text-xl font-bold text-[var(--secondary)]">{commonT('app_name')}</div>

        {canOpenGroups && (
          <div className="mb-4 space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
              {groupsT('team_selector_label')} ({groups.length})
            </label>
            <select
              value={selectedGroupId}
              onChange={(event) => handleGroupSelect(event.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[#10101a] px-3 py-2 text-sm text-slate-200 focus:border-indigo-400 focus:outline-none"
            >
              <option value="">{groupsT('team_selector_placeholder')}</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            {isGroupsLoaded && groups.length === 0 && (
              <p className="text-xs text-slate-400">{groupsT('team_selector_empty')}</p>
            )}
          </div>
        )}

        <nav className="space-y-1">
          {navKeys
            .filter((key) => {
              const requirement = navPermissionRequirements[key];
              if (!requirement) {
                return true;
              }

              if (!isSystemPermissionsLoaded) {
                return false;
              }

              return hasPermissionRequirement(systemPermissions, requirement);
            })
            .filter((key) => {
              const requiredGroupPermissions = selectedGroupNavPermissions[key];
              if (!requiredGroupPermissions) {
                return true;
              }

              if (selectedGroupId) {
                if (!isSelectedGroupPermissionsLoaded || !selectedGroupPermissions) {
                  return false;
                }

                return requiredGroupPermissions.some((permission) => selectedGroupPermissions[permission]);
              }

              if (!areAllGroupPermissionsLoaded) {
                return false;
              }

              return hasAnyGroupPermission(requiredGroupPermissions);
            })
            .map((key) => {
              const Icon = navIcons[key];
              const href = resolveHref(key);
              const active = pathname === href || pathname.startsWith(`${href}/`);

              return (
                <Link
                  key={key}
                  href={href}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                    active ? 'bg-indigo-500/20 text-indigo-200' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon size={16} />
                  {t(key)}
                </Link>
              );
            })}
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          >
            <LogOut size={16} />
            {authT('logout')}
          </button>
        </div>
      </aside>
    </>
  );
}
