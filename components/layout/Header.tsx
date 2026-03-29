'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useMemo} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import LanguageSwitcher from './LanguageSwitcher';
import {useAuthStore} from '@/lib/store/authStore';

const navSegments = new Set(['dashboard', 'groups', 'tasks', 'calendar', 'posts', 'admin', 'profile']);

export default function Header() {
  const pathname = usePathname();
  const locale = useLocale();
  const navT = useTranslations('nav');
  const commonT = useTranslations('common');
  const {user} = useAuthStore();

  const breadcrumb = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean).slice(1);

    if (segments.length === 0) {
      return navT('dashboard');
    }

    return segments
      .map((segment) => (navSegments.has(segment) ? navT(segment) : segment))
      .join(' / ');
  }, [pathname, navT]);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[#0d0d16]/90 px-4 backdrop-blur md:ml-60 md:px-8">
      <div className="display-font text-sm uppercase tracking-wide text-slate-300">{breadcrumb}</div>
      <div className="flex items-center gap-4">
        <LanguageSwitcher />
        <Link
          href={`/${locale}/profile`}
          className="flex items-center gap-2 rounded-md border border-[var(--border)] px-2 py-1 text-sm text-slate-300 hover:bg-slate-800"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/30 font-semibold">
            {(user?.fullname || user?.username || 'U').slice(0, 1).toUpperCase()}
          </div>
          <div className="hidden sm:block leading-tight">
            <div>{user?.fullname || user?.email || commonT('user')}</div>
            <div className="text-xs text-slate-400">{navT('profile')}</div>
          </div>
        </Link>
      </div>
    </header>
  );
}
