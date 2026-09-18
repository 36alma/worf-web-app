'use client';

import {useTranslations} from 'next-intl';
import {translateMinutesStatus} from '@/lib/i18n/minutes';
import type {MinutesStatus} from './types';

const STATUS_CLASSES: Record<MinutesStatus, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-300',
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300',
  ARCHIVED: 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-500'
};

export default function MinutesStatusBadge({status}: {status: MinutesStatus}) {
  const t = useTranslations('group_minutes');
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}
    >
      {translateMinutesStatus(t, status)}
    </span>
  );
}
