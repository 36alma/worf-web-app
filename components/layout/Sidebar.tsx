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
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ElementType } from 'react';
import { getUserGroups } from '@/lib/api/groups';
import { getGroupPermissions } from '@/lib/api/permissions';
import { hasPermissionRequirement, navPermissionRequirements, type NavKey } from '@/lib/permissions/access';
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
  admin: Shield,
  profile: Users
};

const navKeys: NavKey[] = ['dashboard', 'groups', 'tasks', 'calendar', 'posts', 'admin'];

const selectedGroupNavPermissions: Partial<Record<NavKey, string[]>> = {
  tasks: ['group.task.read'],
  calendar: ['group.calendar.read', 'group.calendar.write'],
  posts: ['group.post.read']
};

const normalizeGroups = (payload: unknown): SidebarGroup[] => {
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
  const traverse = (item: unknown) => {
    if (!item || typeof item === 'function') return;
    if (Array.isArray(item)) {
      item.forEach(traverse);
      return;
    }
    if (typeof item === 'object') {
      const record = item as Record<string, unknown>;
      const keys = Object.keys(record);
      const idKey = keys.find((key) => key.toLowerCase().endsWith('id') || key.toLowerCase() === 'id');
      const nameKey = keys.find((key) => key.toLowerCase().includes('name') || key.toLowerCase() === 'title');
      const id = idKey ? record[idKey] : null;
      const name = nameKey ? record[nameKey] : null;
      if (id && id !== 'undefined' && id !== 'null') {
        results.push({ id: String(id), name: String(name || id) });
        return;
      }
      Object.values(record).forEach(traverse);
    }
  };

  traverse(data);
  return results.filter((value, index, all) => all.findIndex((entry) => entry.id === value.id) === index);
};

function SidebarContent({ isMobile }: { isMobile?: boolean }) {
  const t = useTranslations('nav');
  const groupsT = useTranslations('groups');
  const commonT = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { setSidebarOpen, selectedGroupId, setSelectedGroupId } = useUiStore();
  const { user } = useAuthStore();
  const {
    systemPermissions,
    isSystemPermissionsLoaded,
    groupPermissionsById,
    groupPermissionsLoadingById,
    setGroupPermissions,
    setGroupPermissionsLoading
  } = usePermissionStore();

  const [groups, setGroups] = useState<SidebarGroup[]>([]);
  const [isGroupsLoaded, setIsGroupsLoaded] = useState(false);
  const [groupSectionOpen, setGroupSectionOpen] = useState(true);

  const { pathGroupId, pathGroupSubSegment } = useMemo(() => {
    const match = pathname.match(new RegExp(`^/${locale}/groups/([^/]+)(?:/([^/]+))?`));
    return {
      pathGroupId: match?.[1] ?? '',
      pathGroupSubSegment: match?.[2] ?? ''
    };
  }, [pathname, locale]);

  const loadGroups = useCallback(async () => {
    try {
      const response = await getUserGroups();
      setGroups(normalizeGroups(response?.data));
    } catch {
      setGroups([]);
    } finally {
      setIsGroupsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups, pathname]);

  useEffect(() => {
    if (pathGroupId && pathGroupId !== selectedGroupId) {
      setSelectedGroupId(pathGroupId);
    }
  }, [pathGroupId, selectedGroupId, setSelectedGroupId]);

  useEffect(() => {
    if (!pathGroupId || !isGroupsLoaded) return;
    const exists = groups.some((group) => group.id === pathGroupId);
    if (!exists) {
      setSelectedGroupId('');
      router.replace(`/${locale}/groups`);
      router.refresh();
    }
  }, [groups, isGroupsLoaded, locale, pathGroupId, router, setSelectedGroupId]);

  useEffect(() => {
    let mounted = true;
    const loadSelectedGroupPermissions = async () => {
      if (!selectedGroupId) return;
      if (groupPermissionsById[selectedGroupId] || groupPermissionsLoadingById[selectedGroupId]) return;
      setGroupPermissionsLoading(selectedGroupId, true);
      try {
        const permissions = await getGroupPermissions(selectedGroupId);
        if (mounted) {
          setGroupPermissions(selectedGroupId, permissions);
        }
      } catch {
        if (mounted) {
          setGroupPermissions(selectedGroupId, {});
        }
      }
    };
    void loadSelectedGroupPermissions();
    return () => {
      mounted = false;
    };
  }, [
    selectedGroupId,
    groupPermissionsById,
    groupPermissionsLoadingById,
    setGroupPermissions,
    setGroupPermissionsLoading
  ]);

  const selectedGroupPermissions = selectedGroupId ? groupPermissionsById[selectedGroupId] : null;
  const isSelectedGroupPermissionsLoaded = selectedGroupId ? Boolean(selectedGroupPermissions) : true;

  const handleGroupSelect = (groupId: string) => {
    setSelectedGroupId(groupId);
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
    router.push(`/${locale}/groups/${groupId}`);
  };

  const resolveHref = (key: NavKey) => {
    if (!selectedGroupId) return `/${locale}/${key}`;
    if (key === 'groups') return `/${locale}/groups/${selectedGroupId}`;
    if (key === 'calendar') return `/${locale}/groups/${selectedGroupId}/calendar`;
    if (key === 'posts') return `/${locale}/groups/${selectedGroupId}/posts`;
    return `/${locale}/${key}`;
  };

  const filteredNav = navKeys
    .filter((key) => {
      const requirement = navPermissionRequirements[key];
      if (!requirement) return true;
      if (!isSystemPermissionsLoaded) return false;
      return hasPermissionRequirement(systemPermissions, requirement);
    })
    .filter((key) => {
      const requiredGroupPermissions = selectedGroupNavPermissions[key];
      if (!requiredGroupPermissions) return true;
      if (selectedGroupId) {
        if (!isSelectedGroupPermissionsLoaded || !selectedGroupPermissions) return false;
        return requiredGroupPermissions.some((permission) => selectedGroupPermissions[permission]);
      }
      return true;
    });

  const canOpenGroups = (() => {
    const requirement = navPermissionRequirements.groups;
    if (!requirement) return true;
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
              <section>
                <p className="mb-3 px-2 text-[11px] uppercase tracking-[0.05em] text-[var(--text-tertiary)]">{t('workspace')}</p>
                {canOpenGroups && (
                  <Collapsible.Root open={groupSectionOpen} onOpenChange={setGroupSectionOpen}>

                    <Collapsible.Content>
                      <Select.Root value={selectedGroupId || '__none__'} onValueChange={(value) => handleGroupSelect(value === '__none__' ? '' : value)}>
                        <Select.Trigger className="workspace-select inline-flex h-[var(--input-height)] w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)]">
                          <Select.Value placeholder={groupsT('team_selector_placeholder')} />
                          <Select.Icon>
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
                      {isGroupsLoaded && groups.length === 0 && <p className="mt-2 px-1 text-xs text-[var(--text-tertiary)]">{groupsT('team_selector_empty')}</p>}
                    </Collapsible.Content>
                  </Collapsible.Root>
                )}
              </section>

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
            <SidebarContent isMobile />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
