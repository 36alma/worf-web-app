'use client';

import clsx from 'clsx';
import {Check, Languages} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {usePathname, useRouter} from 'next/navigation';
import {useMemo, useTransition} from 'react';
import {locales, type Locale} from '@/i18n/config';

interface LanguageGridProps {
  title: string;
  description: string;
}

const languageMeta: Record<Locale, {emoji: string; key: 'lang_hu' | 'lang_en'}> = {
  hu: {emoji: '🇭🇺', key: 'lang_hu'},
  en: {emoji: '🇬🇧', key: 'lang_en'}
};

export default function LanguageGrid({title, description}: LanguageGridProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const items = useMemo(
    () =>
      locales.map((item) => ({
        locale: item,
        label: t(languageMeta[item].key),
        emoji: languageMeta[item].emoji
      })),
    [t]
  );

  const handleLocaleChange = (nextLocale: Locale) => {
    if (nextLocale === locale) {
      return;
    }

    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; samesite=lax`;

    const segments = pathname.split('/');
    segments[1] = nextLocale;
    const nextPath = segments.join('/');

    startTransition(() => {
      router.replace(nextPath);
      router.refresh();
    });
  };

  return (
    <section className="surface space-y-4 rounded-[var(--radius-lg)] p-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.75} />
          <h2 className="display-font text-lg text-[var(--text-primary)]">{title}</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">{description}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const isActive = item.locale === locale;

          return (
            <button
              key={item.locale}
              type="button"
              onClick={() => handleLocaleChange(item.locale)}
              disabled={isPending}
              className={clsx(
                'group relative flex min-h-[88px] items-start justify-between rounded-[var(--radius-lg)] border p-4 text-left transition-colors',
                isActive
                  ? 'border-orange-500 bg-[var(--accent-subtle)]'
                  : 'border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]'
              )}
            >
              <div>
                <p className="text-base font-medium text-[var(--text-primary)]">{item.label}</p>
                <p className="mt-1 text-2xl leading-none">{item.emoji}</p>
              </div>

              <span
                className={clsx(
                  'flex h-7 w-7 items-center justify-center rounded-full border text-[var(--text-secondary)]',
                  isActive
                    ? 'border-orange-500 bg-orange-500 text-white'
                    : 'border-[var(--border-default)] bg-[var(--bg-surface)] group-hover:text-[var(--text-primary)]'
                )}
              >
                {isActive ? <Check className="h-4 w-4" strokeWidth={2} /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
