'use client';

import * as Avatar from '@radix-ui/react-avatar';
import * as Collapsible from '@radix-ui/react-collapsible';
import * as Dialog from '@radix-ui/react-dialog';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import * as Select from '@radix-ui/react-select';
import * as Separator from '@radix-ui/react-separator';
import * as Tooltip from '@radix-ui/react-tooltip';
import { CalendarDays, Check, ChevronDown, ClipboardList, HelpCircle, Home, Shield, Sparkles, StickyNote, Users, X } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ElementType } from 'react';
import { getUserGroups } from '@/lib/api/groups';
import { getGroupPermissions } from '@/lib/api/permissions';
import { normalizeGroupId } from '@/lib/utils/groupId';
import {
  hasPermissionRequirement,
  navPermissionRequirements,
  groupNavPermissionRequirements,
  type NavKey
} from '@/lib/permissions/access';
import { useAuthStore } from '@/lib/store/authStore';
import { usePermissionStore } from '@/lib/store/permissionStore';
import { useUiStore } from '@/lib/store/uiStore';

export interface SidebarGroup {
  id: string;
  name: string;
}

const navIcons: Record<NavKey, ElementType> = {
  dashboard: Home,
  groups: Users,
  tasks: ClipboardList,
  calendar: CalendarDays,
  posts: StickyNote,
  roles: Shield,
  permissions: Shield,
  admin: Shield,
  profile: Users
};

const navKeys: NavKey[] = ['dashboard', 'groups', 'tasks', 'calendar', 'posts', 'roles', 'permissions', 'admin'];

const readData = (payload: unknown): unknown => {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const candidate = payload as Record<string, unknown>;
  if ('data' in candidate) {
    return candidate.data;
  }

  return payload;
};

const findArrayValue = (source: unknown): unknown[] => {
  if (Array.isArray(source)) {
    return source;
  }

  if (!source || typeof source !== 'object') {
    return [];
  }

  const objectValue = source as Record<string, unknown>;
  const knownArray = ['group_users', 'groups', 'items', 'rows', 'result'].find((key) => Array.isArray(objectValue[key]));
  if (knownArray) {
    return objectValue[knownArray] as unknown[];
  }

  for (const value of Object.values(objectValue)) {
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
};

const normalizeGroups = (payload: unknown): SidebarGroup[] => {
  const source = readData(payload);
  const arrayValue = findArrayValue(source);

  return arrayValue
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const row = item as Record<string, unknown>;
      const rawId = String(row.group_id ?? row.id ?? '').trim();
      const id = normalizeGroupId(rawId);
      if (!id) {
        return null;
      }

      return {
        id,
        name: String(row.group_name ?? row.name ?? id)
      };
    })
    .filter((value): value is SidebarGroup => value !== null);
};

function SidebarContent({ isMobile }: { isMobile?: boolean }) {
  const t = useTranslations('nav');
  const groupsT = useTranslations('groups');
  const commonT = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const groupId = normalizeGroupId(typeof params.groupId === 'string' ? params.groupId : '');
  const { setSidebarOpen, selectedGroupId, selectedGroupName, setSelectedGroupId } = useUiStore();
  const { user } = useAuthStore();
  const {
    systemPermissions,
    isSystemPermissionsLoaded,
    groupPermissionsById,
    groupPermissionsStatusById,
    setGroupPermissions,
    setGroupPermissionsLoading,
    setGroupPermissionsError
  } = usePermissionStore();

  const [groups, setGroups] = useState<SidebarGroup[]>([]);
  const [isGroupsLoaded, setIsGroupsLoaded] = useState(false);
  const [isGroupsLoadError, setIsGroupsLoadError] = useState(false);
  const [groupSectionOpen, setGroupSectionOpen] = useState(true);

  const { pathGroupId, pathGroupSubSegment } = useMemo(() => {
    const match = pathname.match(new RegExp(`^/${locale}/groups/([^/]+)(?:/([^/]+))?`));
    const res = {
      pathGroupId: groupId || '',
      pathGroupSubSegment: match?.[2] ?? ''
    };
    return res;
  }, [pathname, locale, groupId]);

  const loadGroups = useCallback(async () => {
    const CACHE_KEY = 'worf_user_groups_cache';
    const CACHE_TIME = 60 * 60 * 1000; // 1 hour

    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < CACHE_TIME) {
              setGroups(normalizeGroups(parsed.data));
              setIsGroupsLoadError(false);
              setIsGroupsLoaded(true);
              return;
            }
          } catch (e) {
            // Invalid cache, ignore and fetch
          }
        }
      }

      const response = await getUserGroups();
      
      if (typeof window !== 'undefined') {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          data: response?.data
        }));
      }

      setGroups(normalizeGroups(response?.data));
      setIsGroupsLoadError(false);
    } catch {
      setGroups([]);
      setIsGroupsLoadError(true);
    } finally {
      setIsGroupsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups, pathname]);

  useEffect(() => {
    if (pathGroupId) {
      const groupName = groups.find(g => g.id === pathGroupId)?.name;
      if (pathGroupId !== selectedGroupId || (groupName && groupName !== selectedGroupName)) {
        setSelectedGroupId(pathGroupId, groupName);
      }
    }
  }, [pathGroupId, selectedGroupId, selectedGroupName, setSelectedGroupId, groups]);

  const activeGroupId = pathGroupId || selectedGroupId;

  useEffect(() => {
    if (!pathGroupId || !isGroupsLoaded || isGroupsLoadError) return;
    const exists = groups.some((group) => group.id === pathGroupId);
    if (!exists) {
      // Silent Policy: if the group is no longer in the user's list,
      // just clear the selected state. Do NOT redirect — that creates
      // a redirect loop when combined with AppShell's permission guard.
      setSelectedGroupId('');
    }
  }, [groups, isGroupsLoadError, isGroupsLoaded, pathGroupId, setSelectedGroupId]);

  useEffect(() => {
    let mounted = true;
    const loadSelectedGroupPermissions = async () => {
      if (!activeGroupId) return;
      const permissionStatus = groupPermissionsStatusById[activeGroupId];
      if (permissionStatus === 'loading' || permissionStatus === 'loaded' || permissionStatus === 'error') return;
      setGroupPermissionsLoading(activeGroupId, true);
      try {
        const permissions = await getGroupPermissions(activeGroupId);
        if (mounted) {
          setGroupPermissions(activeGroupId, permissions);
        }
      } catch {
        if (mounted) {
          setGroupPermissionsError(activeGroupId);
        }
      }
    };
    void loadSelectedGroupPermissions();
    return () => {
      mounted = false;
    };
  }, [
    activeGroupId,
    groupPermissionsStatusById,
    setGroupPermissions,
    setGroupPermissionsError,
    setGroupPermissionsLoading
  ]);

  const activeGroupPermissions = activeGroupId ? groupPermissionsById[activeGroupId] : null;
  const activeGroupPermissionStatus = activeGroupId
    ? groupPermissionsStatusById[activeGroupId] ?? 'idle'
    : 'loaded';

  const handleGroupSelect = (groupId: string) => {
    const selectedGroup = groups.find(g => g.id === groupId);
    setSelectedGroupId(groupId, selectedGroup?.name);
    if (!groupId) {
      if (pathGroupSubSegment === 'calendar') {
        router.push(`/${locale}/calendar`);
      } else if (pathGroupSubSegment === 'posts') {
        router.push(`/${locale}/posts`);
      } else {
        router.push(`/${locale}/groups`);
      }
      router.refresh();
      return;
    }
    router.push(`/${locale}/groups/${encodeURIComponent(groupId)}`);
  };

  const resolveHref = (key: NavKey) => {
    if (!activeGroupId) return `/${locale}/${key}`;
    const encodedGroupId = encodeURIComponent(activeGroupId);
    if (key === 'groups') return `/${locale}/groups/${encodedGroupId}`;
    if (key === 'tasks') return `/${locale}/groups/${encodedGroupId}/tasks`;
    if (key === 'calendar') return `/${locale}/groups/${encodedGroupId}/calendar`;
    if (key === 'posts') return `/${locale}/posts`; // Posts feed is global and context-aware
    if (key === 'roles') return `/${locale}/groups/${encodedGroupId}/roles`;
    if (key === 'permissions') return `/${locale}/groups/${encodedGroupId}/permissions`;
    return `/${locale}/${key}`;
  };

  const filteredNav = navKeys.filter((key) => {
    if (activeGroupId) {
      // In group context: completely hide roles and permissions (not rendered, not disabled)
      // These are global/admin-only items with no function within a group
      if (key === 'roles' || key === 'permissions') {
        return false;
      }

      // Group context - apply normal permission filtering
      const requiredGroupPermissions = groupNavPermissionRequirements[key];
      if (requiredGroupPermissions) {
        if (activeGroupPermissionStatus !== 'loaded' || !activeGroupPermissions) return true;
        return hasPermissionRequirement(activeGroupPermissions, requiredGroupPermissions, { mode: 'explicit' });
      }
      
      const globalRequirement = navPermissionRequirements[key];
      if (globalRequirement === 'GROUP_ONLY') return true; 
      if (globalRequirement) {
        if (!isSystemPermissionsLoaded) return false;
        return hasPermissionRequirement(systemPermissions, globalRequirement);
      }
      return true;
    } else {
      // Global context - show all items with appropriate permissions
      if (key === 'groups') return false;

      const globalRequirement = navPermissionRequirements[key];
      if (globalRequirement === 'GROUP_ONLY') return false; 
      if (globalRequirement) {
        if (!isSystemPermissionsLoaded) return false;
        return hasPermissionRequirement(systemPermissions, globalRequirement);
      }
      return true;
    }
  });

  const canOpenGroups = (() => {
    const requirement = navPermissionRequirements.groups;
    if (!requirement) return true;
    if (requirement === 'GROUP_ONLY') return true;
    if (!isSystemPermissionsLoaded) return false;
    return hasPermissionRequirement(systemPermissions, requirement);
  })();

  return (
    <Tooltip.Provider delayDuration={180}>
      <div className="flex h-full flex-col">
        {isMobile && (
          <div className="sidebar-sheet-header">
            <Link href={`/${locale}/dashboard`} className="sidebar-sheet-logo" onClick={() => setSidebarOpen(false)}>
              <Sparkles size={20} strokeWidth={1.75} />
              <span>{commonT('app_name')}</span>
            </Link>
            <Dialog.Close asChild>
              <button type="button" className="sidebar-close-btn" aria-label="Menü bezárása">
                <X size={18} strokeWidth={1.75} />
              </button>
            </Dialog.Close>
          </div>
        )}
        <ScrollArea.Root className="flex-1">
          <ScrollArea.Viewport className={`h-full p-[var(--sidebar-padding)] ${isMobile ? 'pb-2' : ''}`}>
            <div className="space-y-6">
              {canOpenGroups && isGroupsLoaded && groups.length > 0 && (
                <section>
                  <p className="mb-3 px-2 text-[11px] uppercase tracking-[0.05em] text-[var(--text-tertiary)]">{t('workspace')}</p>
                  <Collapsible.Root open={groupSectionOpen} onOpenChange={setGroupSectionOpen}>
                    <Collapsible.Content>
                      <Select.Root value={activeGroupId || '__none__'} onValueChange={(value) => handleGroupSelect(value === '__none__' ? '' : value)}>
                        <Select.Trigger className="workspace-select inline-flex h-[var(--input-height)] w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)]">
                          <span className="truncate">
                            <Select.Value placeholder={groupsT('team_selector_placeholder')}>
                              {activeGroupId && activeGroupId !== '__none__'
                                ? groups.find((g) => g.id === activeGroupId)?.name || selectedGroupName || groupsT('team_selector_placeholder')
                                : groupsT('team_selector_placeholder')}
                            </Select.Value>
                          </span>
                          <Select.Icon className="ml-2 flex-shrink-0">
                            <ChevronDown size={14} strokeWidth={1.75} className="chevron text-[var(--text-tertiary)]" />
                          </Select.Icon>
                        </Select.Trigger>
                        <Select.Portal>
                          <Select.Content className="dropdown-content z-50 max-h-64 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1">
                            <Select.Viewport>
                              <Select.Item value="__none__" className="relative flex cursor-pointer items-center rounded-[var(--radius-sm)] py-2 pl-8 pr-3 text-sm text-[var(--text-primary)] data-[highlighted]:bg-[var(--bg-hover)] data-[highlighted]:outline-none">
                                <Select.ItemIndicator className="absolute left-2"><Check size={14} strokeWidth={1.75} /></Select.ItemIndicator>
                                <Select.ItemText>{groupsT('team_selector_placeholder')}</Select.ItemText>
                              </Select.Item>
                              {groups.map((group) => (
                                <Select.Item key={group.id} value={group.id} className="relative flex cursor-pointer items-center rounded-[var(--radius-sm)] py-2 pl-8 pr-3 text-sm text-[var(--text-primary)] data-[highlighted]:bg-[var(--bg-hover)] data-[highlighted]:outline-none">
                                  <Select.ItemIndicator className="absolute left-2"><Check size={14} strokeWidth={1.75} /></Select.ItemIndicator>
                                  <Select.ItemText>{group.name}</Select.ItemText>
                                </Select.Item>
                              ))}
                            </Select.Viewport>
                          </Select.Content>
                        </Select.Portal>
                      </Select.Root>
                    </Collapsible.Content>
                  </Collapsible.Root>
                </section>
              )}

              <section>
                <p className="mb-2 px-2 text-[11px] uppercase tracking-[0.05em] text-[var(--text-tertiary)]">{t('navigation')}</p>
                <nav role="navigation" className="space-y-[1px]">
                  {filteredNav.map((key) => {
                    const Icon = navIcons[key];
                    const href = resolveHref(key);
                    const active = pathname === href || pathname.startsWith(`${href}/`);

                    return (
                      <Tooltip.Root key={key}>
                        <Tooltip.Trigger asChild>
                          <Link
                            href={href}
                            aria-current={active ? 'page' : undefined}
                            onClick={() => {
                              if (isMobile) setSidebarOpen(false);
                            }}
                            className={`sidebar-item flex h-[var(--sidebar-item-height)] items-center gap-[10px] rounded-[8px] px-3 text-[13px] ${active
                              ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-medium'
                              : 'bg-transparent text-[var(--text-secondary)] font-normal hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                              }`}
                          >
                            <Icon size={18} strokeWidth={1.75} />
                            {t(key)}
                          </Link>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content className="dropdown-content rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--text-primary)]">
                            {t(key)}
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    );
                  })}
                </nav>
              </section>
            </div>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" className="flex w-2 touch-none p-0.5">
            <ScrollArea.Thumb className="relative flex-1 rounded-full bg-[var(--border-hover)]" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      </div>
      {isMobile && (
        <div className="sidebar-sheet-footer">
          <Link
            href={`/${locale}/profile`}
            className="sidebar-item flex h-[var(--sidebar-item-height)] items-center gap-[10px] rounded-[8px] px-3 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            onClick={() => setSidebarOpen(false)}
          >
            <HelpCircle size={18} strokeWidth={1.75} />
            {t('profile')}
          </Link>
        </div>
      )}
    </Tooltip.Provider>
  );
}

export default function Sidebar() {
  const { mobileSidebarOpen, setSidebarOpen } = useUiStore();

  return (
    <>
      <aside className="sidebar fixed bottom-0 left-0 top-[var(--topbar-height)] z-20 hidden w-[var(--sidebar-width)] border-r border-[var(--border-subtle)] bg-[var(--bg-sidebar)] lg:block">
        <SidebarContent />
      </aside>

      <Dialog.Root open={mobileSidebarOpen} onOpenChange={setSidebarOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="sidebar-overlay fixed inset-0 z-40 bg-black/55 lg:hidden" />
          <Dialog.Content className="sidebar-sheet dialog-content fixed bottom-0 left-0 top-0 z-50 w-[min(88vw,var(--sidebar-width))] border-r border-[var(--border-subtle)] bg-[var(--bg-sidebar)] lg:hidden">
            <Dialog.Title className="sr-only">Sidebar navigation</Dialog.Title>
            <SidebarContent isMobile />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
