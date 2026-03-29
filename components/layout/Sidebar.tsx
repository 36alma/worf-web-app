'use client';

import {useEffect, useMemo, useState} from 'react';
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
  Users
} from 'lucide-react';
import {logout} from '@/lib/api/auth';
import {getUserGroups} from '@/lib/api/groups';
import {hasPermissionRequirement, navPermissionRequirements, type NavKey} from '@/lib/permissions/access';
import {usePermissionStore} from '@/lib/store/permissionStore';
import {useUiStore} from '@/lib/store/uiStore';

const navIcons = {
  dashboard: LayoutDashboard,
  groups: Users,
  tasks: ClipboardList,
  calendar: CalendarDays,
  posts: StickyNote,
  admin: Shield
};

const navKeys: NavKey[] = ['dashboard', 'groups', 'tasks', 'calendar', 'posts', 'admin'];

interface SidebarGroup {
  id: string;
  name: string;
}

const normalizeGroups = (payload: unknown): SidebarGroup[] => {
  const raw = typeof payload === 'object' && payload !== null && 'data' in payload ? payload.data : payload;
  const source = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && 'groups' in raw && Array.isArray((raw as {groups?: unknown}).groups)
      ? ((raw as {groups: unknown[]}).groups ?? [])
      : [];

  return source
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const candidate = item as Record<string, unknown>;
      const id = String(candidate.group_id ?? candidate.groupId ?? candidate.id ?? '');
      const name = String(candidate.group_name ?? candidate.name ?? candidate.title ?? '');

      if (!id) {
        return null;
      }

      return {id, name: name || id};
    })
    .filter((group): group is SidebarGroup => Boolean(group));
};

export default function Sidebar() {
  const t = useTranslations('nav');
  const authT = useTranslations('auth');
  const commonT = useTranslations('common');
  const groupsT = useTranslations('groups');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const {mobileSidebarOpen, toggleSidebar, setSidebarOpen} = useUiStore();
  const {systemPermissions, isSystemPermissionsLoaded, clearPermissions} = usePermissionStore();
  const [groups, setGroups] = useState<SidebarGroup[]>([]);
  const [isGroupsLoaded, setIsGroupsLoaded] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadGroups = async () => {
      try {
        const response = await getUserGroups();
        const groupList = normalizeGroups(response?.data);
        if (mounted) {
          setGroups(groupList);
        }
      } catch {
        if (mounted) {
          setGroups([]);
        }
      } finally {
        if (mounted) {
          setIsGroupsLoaded(true);
        }
      }
    };

    loadGroups();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const match = pathname.match(new RegExp(`^/${locale}/groups/([^/]+)`));
    const pathGroupId = match?.[1] ?? '';
    setSelectedGroupId(pathGroupId || '');
  }, [pathname, locale]);

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
      return;
    }

    router.push(`/${locale}/groups/${groupId}`);
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
              {groupsT('team_selector_label')}
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
            .map((key) => {
              const Icon = navIcons[key];
              const href = `/${locale}/${key}`;
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
