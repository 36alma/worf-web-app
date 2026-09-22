'use client';

import {useTranslations} from 'next-intl';
import {Archive} from 'lucide-react';

/**
 * "Archivált" — the user archived the record (`archived_at`). Not the `ARCHIVED` *status*
 * ({@link MinutesStatusBadge} shows that one as "Leváltott": a newer version replaced it).
 */
export default function MinutesArchivedBadge() {
  const t = useTranslations('group_minutes');
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-300">
      <Archive className="h-3 w-3" aria-hidden />
      {t('list.archived_badge')}
    </span>
  );
}
