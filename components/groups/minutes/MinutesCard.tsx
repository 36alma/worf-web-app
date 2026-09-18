'use client';

import {useLocale, useTranslations} from 'next-intl';
import Link from 'next/link';
import MinutesStatusBadge from './MinutesStatusBadge';
import type {MeetingMinutes} from './types';

export default function MinutesCard({groupId, minutes}: {groupId: string; minutes: MeetingMinutes}) {
  const t = useTranslations('group_minutes');
  const locale = useLocale();
  const meetingDate = new Date(minutes.meeting_date).toLocaleDateString(locale);

  return (
    <Link
      href={`/${locale}/groups/${encodeURIComponent(groupId)}/minutes/${encodeURIComponent(minutes.id)}`}
      className="flex items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 transition-colors hover:bg-[var(--bg-hover)]"
    >
      <div className="min-w-0">
        <div className="truncate font-medium text-[var(--text-primary)]">{minutes.subject}</div>
        <div className="text-sm text-[var(--text-secondary)]">
          {meetingDate}
          {minutes.version > 1 ? ` · ${t('list.version_label', {version: minutes.version})}` : ''}
        </div>
      </div>
      <MinutesStatusBadge status={minutes.status} />
    </Link>
  );
}
