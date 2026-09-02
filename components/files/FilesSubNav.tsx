'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Folder, Star, Trash2, Users } from 'lucide-react';

const ITEMS = [
  { key: 'root', href: '', icon: Folder },
  { key: 'starred', href: '/starred', icon: Star },
  { key: 'sharedWithMe', href: '/shared-with-me', icon: Users },
  { key: 'trash', href: '/trash', icon: Trash2 },
] as const;

export default function FilesSubNav() {
  const t = useTranslations('files');
  const locale = useLocale();
  const pathname = usePathname();
  const base = `/${locale}/files`;

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)] pb-2">
      {ITEMS.map(({ key, href, icon: Icon }) => {
        const target = `${base}${href}`;
        const active = href === '' ? pathname === base : pathname.startsWith(target);
        return (
          <Link
            key={key}
            href={target}
            className={`flex shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-sm ${
              active ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-medium' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Icon size={15} strokeWidth={1.75} />
            {t(`subnav.${key}`)}
          </Link>
        );
      })}
    </nav>
  );
}
