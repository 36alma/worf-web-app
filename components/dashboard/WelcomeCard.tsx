'use client';

import Link from 'next/link';
import {useLocale, useTranslations} from 'next-intl';
import {BookOpen, Plus, Sparkles} from 'lucide-react';
import Card from '@/components/ui/Card';
import {buttonVariants} from '@/components/ui/Button';
import {useDashboard} from './DashboardProvider';

/** The first-steps card — only for a user who is not in any group yet (`summary.group_count === 0`). */
export default function WelcomeCard() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const {summary} = useDashboard();

  if (summary?.group_count !== 0) return null;

  return (
    <Card className="p-6">
      <div className="mb-5 flex gap-4">
        <div className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-secondary">
          <Sparkles size={24} strokeWidth={1.75} />
        </div>
        <div>
          <h3 className="mb-1 text-base font-medium text-fg">{t('welcome')}</h3>
          <p className="text-[13px] leading-[1.5] text-fg-secondary">{t('welcome_description')}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Link href={`/${locale}/groups`} className={buttonVariants({variant: 'primary'})}>
          <Plus size={16} strokeWidth={1.75} />
          {t('create_first_group')}
        </Link>
        <Link href={`/${locale}/profile`} className={buttonVariants({variant: 'ghost'})}>
          <BookOpen size={16} strokeWidth={1.75} />
          {t('read_documentation')}
        </Link>
      </div>
    </Card>
  );
}
