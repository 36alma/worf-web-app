'use client';

import Link from 'next/link';
import { ReactNode, useEffect, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { hasPermissionRequirement, type PermissionRequirement } from '@/lib/permissions/access';
import { usePermissionStore } from '@/lib/store/permissionStore';

interface SectionConfig {
  key: 'users' | 'groups' | 'roles';
  requirement: PermissionRequirement;
}

const sectionConfigs: SectionConfig[] = [
  {
    key: 'users',
    requirement: { anyOf: ['user.get.prealluser', 'user.get.edit.admin.userprofil', 'user.post.edit.admin.userprofil'] }
  },
  {
    key: 'groups',
    requirement: { anyOf: ['group.get.all.group', 'group.create', 'group.modify.base', 'group.delete.group'] }
  },
  {
    key: 'roles',
    requirement: { anyOf: ['role.get.all.role'] }
  }
];

export default function AdminLayoutClient({ children }: { children: ReactNode }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { systemPermissions, isSystemPermissionsLoaded } = usePermissionStore();

  const allowedSections = useMemo(
    () =>
      sectionConfigs.filter(({ requirement }) => {
        if (!isSystemPermissionsLoaded) {
          return false;
        }

        return hasPermissionRequirement(systemPermissions, requirement);
      }),
    [systemPermissions, isSystemPermissionsLoaded]
  );

  useEffect(() => {
    if (!isSystemPermissionsLoaded) {
      return;
    }

    if (allowedSections.length === 0) {
      router.replace(`/${locale}/dashboard`);
      return;
    }

    const section = pathname.split('/').filter(Boolean).slice(2)[0] ?? '';
    const isValidSection = allowedSections.some(({ key }) => key === section);

    if (section === '' || !isValidSection) {
      router.replace(`/${locale}/admin/${allowedSections[0].key}`);
    }
  }, [allowedSections, isSystemPermissionsLoaded, locale, pathname, router]);

  if (!isSystemPermissionsLoaded || allowedSections.length === 0) {
    return <section className="space-y-4" />;
  }

  const activeSection = pathname.split('/').filter(Boolean).slice(2)[0] ?? allowedSections[0].key;

  return (
    <section className="space-y-4">
      <h1 className="display-font text-[var(--text-primary)] text-2xl">{t('title')}</h1>
      <p className="text-sm text-slate-300">{t('subtitle')}</p>

      <div className="flex flex-wrap gap-2">
        {allowedSections.map(({ key }) => {
          const href = `/${locale}/admin/${key}`;
          const active = activeSection === key;
          return (
            <Link
              key={key}
              href={href}
              className={`rounded-md border px-3 py-2 text-sm transition ${active
                ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-200'
                : 'border-[var(--border)] text-slate-300 hover:bg-slate-800'
                }`}
            >
              {t(`sections.${key}`)}
            </Link>
          );
        })}
      </div>

      {children}
    </section>
  );
}
