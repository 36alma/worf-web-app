'use client';

import * as Select from '@radix-ui/react-select';
import {Check, ChevronDown, Languages} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {usePathname, useRouter} from 'next/navigation';

export interface LanguageOption {
  code: string;
  label: string;
}

export default function LanguageSwitcher() {
  const t = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const langs: LanguageOption[] = [
    {code: 'hu', label: t('lang_hu')},
    {code: 'en', label: t('lang_en')}
  ];

  const onChangeLocale = (nextLocale: string) => {
    const segments = pathname.split('/');
    segments[1] = nextLocale;
    router.push(segments.join('/'));
  };

  return (
    <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
      <Languages size={16} strokeWidth={1.75} />
      <Select.Root value={locale} onValueChange={onChangeLocale}>
        <Select.Trigger
          className="inline-flex h-[var(--input-height)] min-w-36 items-center justify-between gap-2 rounded-[var(--input-radius)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-left text-[var(--text-primary)] hover:border-[var(--border-hover)]"
          aria-label={t('language')}
        >
          <Select.Value />
          <Select.Icon>
            <ChevronDown size={14} strokeWidth={1.75} />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content className="dropdown-content z-50 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1">
            <Select.Viewport>
              {langs.map((lang) => (
                <Select.Item
                  key={lang.code}
                  value={lang.code}
                  className="relative flex cursor-pointer items-center rounded-[var(--radius-sm)] py-2 pl-8 pr-3 text-sm text-[var(--text-primary)] data-[highlighted]:bg-[var(--bg-hover)] data-[highlighted]:outline-none"
                >
                  <Select.ItemIndicator className="absolute left-2 inline-flex items-center">
                    <Check size={14} strokeWidth={1.75} />
                  </Select.ItemIndicator>
                  <Select.ItemText>{lang.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
