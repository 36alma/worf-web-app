'use client';

import * as Avatar from '@radix-ui/react-avatar';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {ChevronRight, LogOut, Menu, Sparkles, UserCircle} from 'lucide-react';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {useCallback, useMemo} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {logout} from '@/lib/api/auth';
import {type NavKey} from '@/lib/permissions/access';
import {usePermissionStore} from '@/lib/store/permissionStore';
import {useUiStore} from '@/lib/store/uiStore';
import {useAuthStore} from '@/lib/store/authStore';

export interface HeaderProps {
  className?: string;
}

const navKeys: NavKey[] = ['dashboard', 'groups', 'tasks', 'calendar', 'posts', 'roles', 'permissions', 'admin', 'profile'];

export default function Header({className}: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const navT = useTranslations('nav');
  const commonT = useTranslations('common');
  const authT = useTranslations('auth');
  const postsT = useTranslations('posts');
  const {user} = useAuthStore();
  const {clearPermissions} = usePermissionStore();
  const {toggleSidebar, selectedGroupName} = useUiStore();

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch {
      // Best-effort logout: continue local cleanup and redirect even if upstream logout fails.
    }
    clearPermissions();
    router.push(`/${locale}/auth/login`);
    router.refresh();
  }, [clearPermissions, locale, router]);

  const breadcrumb = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean).slice(1);
    const current = segments.at(-1) ?? 'dashboard';
    const parent = segments.at(-2) ?? '';
    const grandparent = segments.at(-3) ?? '';

    let parentLabel = parent === 'posts' ? postsT('title') : navKeys.find((key) => key === parent) ? navT(parent as NavKey) : '';
    const parentHref = '/' + [locale, ...segments.slice(0, -1)].join('/');

    let currentLabel = navKeys.find((key) => key === current) ? navT(current as NavKey) : current;
    
    // If we are at /groups/[groupId], display the group name instead of the raw ID
    if (parent === 'groups') {
      currentLabel = selectedGroupName || current;
    }
    
    // If we are at /groups/[groupId]/[subRoute], display the group name as the parent instead of the raw ID
    if (grandparent === 'groups') {
      parentLabel = selectedGroupName || parent;
    }

    if (current === 'new' && parent === 'posts') currentLabel = postsT('createPost');
    if (current === 'edit') currentLabel = postsT('edit.pageTitle');
    if (parent === 'posts' && current !== 'new' && current !== 'edit') currentLabel = postsT('detail.title');

    return {parentLabel, currentLabel, parentHref};
  }, [locale, pathname, navT, postsT, selectedGroupName]);

  return (
    <header className={`topbar ${className ?? ''}`}>
      <button type="button" onClick={toggleSidebar} className="topbar-hamburger" aria-label="Open menu">
        <Menu size={20} strokeWidth={1.75} />
      </button>

      <Link href={`/${locale}/dashboard`} className="topbar-logo" aria-label="WORF home">
        <Sparkles size={20} strokeWidth={1.75} />
        <span className="topbar-logo-text">{commonT('app_name')}</span>
      </Link>

      <nav className="topbar-breadcrumb" aria-label="Breadcrumb">
        <Link href={`/${locale}/dashboard`} className="hover:text-[var(--text-primary)]">
          {navT('dashboard')}
        </Link>
        {breadcrumb.parentLabel ? (
          <>
            <ChevronRight size={14} strokeWidth={1.75} className="breadcrumb-sep" />
            <Link href={breadcrumb.parentHref} className="hover:text-[var(--text-primary)]">
              {breadcrumb.parentLabel}
            </Link>
          </>
        ) : null}
        <ChevronRight size={14} strokeWidth={1.75} className="breadcrumb-sep" />
        <span className="breadcrumb-current">{breadcrumb.currentLabel}</span>
      </nav>

      <div className="topbar-spacer" />

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" className="topbar-avatar" aria-label="Profile menu">
            <Avatar.Root className="avatar-sm">
              <Avatar.Image src={user?.avatar} alt={user?.fullname ?? user?.username ?? 'User'} className="h-full w-full object-cover" />
              <Avatar.Fallback className="avatar-fallback">
                {(user?.fullname || user?.username || 'U').slice(0, 2).toUpperCase()}
              </Avatar.Fallback>
            </Avatar.Root>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="dropdown-content z-50 min-w-44 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1" align="end">
            <DropdownMenu.Item asChild>
              <Link
                href={`/${locale}/profile`}
                className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-2 text-sm text-[var(--text-primary)] outline-none hover:bg-[var(--bg-hover)]"
              >
                <UserCircle size={16} strokeWidth={1.75} />
                {navT('profile')}
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-[var(--border-subtle)]" />
            <DropdownMenu.Item
              onClick={handleLogout}
              className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-2 text-sm text-[var(--error)] outline-none hover:bg-[var(--bg-hover)]"
            >
              <LogOut size={16} strokeWidth={1.75} />
              {authT('logout')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </header>
  );
}
