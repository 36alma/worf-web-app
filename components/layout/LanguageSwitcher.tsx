'use client';

import {useLocale, useTranslations} from 'next-intl';
import {usePathname, useRouter} from 'next/navigation';

export default function LanguageSwitcher() {
  const t = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const langs = [
    {code: 'hu', label: t('lang_hu')},
    {code: 'en', label: t('lang_en')}
  ];

  const onChangeLocale = (nextLocale: string) => {
    const segments = pathname.split('/');
    segments[1] = nextLocale;
    router.push(segments.join('/'));
  };

  return (
    <label className="flex items-center gap-2 text-sm text-slate-300">
      <span>{t('language')}</span>
      <select
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-slate-100"
        value={locale}
        onChange={(event) => onChangeLocale(event.target.value)}
      >
        {langs.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </label>
  );
}
