'use client';

import Link from 'next/link';
import {useLocale, useTranslations} from 'next-intl';
import {CalendarDays, CheckSquare, Users, type LucideIcon} from 'lucide-react';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import {describeDay} from '@/lib/utils/dashboardDates';
import {cn} from '@/lib/utils/cn';
import {useDashboard} from './DashboardProvider';

/** Anchors of the widgets the task / event cards scroll to — there is no cross-group task or calendar page. */
export const DASHBOARD_TASKS_ANCHOR = 'dashboard-tasks';
export const DASHBOARD_EVENTS_ANCHOR = 'dashboard-events';

interface Kpi {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  iconClass: string;
  value: number | null;
  sub: string;
  /** Highlights the subtitle (an overdue count needs attention). */
  attention?: boolean;
}

export default function DashboardKpis() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const {summary, summaryLoading, summaryFailed} = useDashboard();

  const nextEvent = summary?.next_event_at ? describeDay(summary.next_event_at, new Date(), locale) : null;
  const eventsSub = !summary
    ? ''
    : !nextEvent
      ? t('kpi.no_upcoming')
      : nextEvent.bucket === 'today'
        ? t('kpi.next_today', {time: nextEvent.time})
        : nextEvent.bucket === 'tomorrow'
          ? t('kpi.next_tomorrow', {time: nextEvent.time})
          : t('kpi.next_other', {day: nextEvent.day, time: nextEvent.time});

  const cards: Kpi[] = [
    {
      key: 'groups',
      href: `/${locale}/groups`,
      label: t('active_groups'),
      icon: Users,
      iconClass: 'bg-surface-2 text-fg-secondary',
      value: summary?.group_count ?? null,
      sub: t('kpi.groups_hint')
    },
    {
      key: 'tasks',
      href: `#${DASHBOARD_TASKS_ANCHOR}`,
      label: t('open_tasks'),
      icon: CheckSquare,
      iconClass: 'bg-info-bg text-info',
      value: summary?.open_tasks_count ?? null,
      sub: !summary
        ? ''
        : summary.overdue_tasks_count > 0
          ? t('kpi.overdue', {count: summary.overdue_tasks_count})
          : t('kpi.no_overdue'),
      attention: (summary?.overdue_tasks_count ?? 0) > 0
    },
    {
      key: 'events',
      href: `#${DASHBOARD_EVENTS_ANCHOR}`,
      label: t('upcoming_events'),
      icon: CalendarDays,
      iconClass: 'bg-success-bg text-success',
      value: summary?.upcoming_events_count ?? null,
      sub: eventsSub
    }
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Link
            key={card.key}
            href={card.href}
            className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <Card interactive className="p-5">
              <div className="mb-4 flex items-center gap-2.5">
                <div className={`inline-flex size-9 items-center justify-center rounded-md ${card.iconClass}`}>
                  <Icon size={18} strokeWidth={1.75} />
                </div>
                <span className="text-[13px] text-fg-secondary">{card.label}</span>
              </div>
              {card.value === null ? (
                summaryLoading && !summaryFailed ? (
                  <>
                    <Skeleton className="mb-2 h-7 w-12" />
                    <Skeleton className="h-4 w-28" />
                  </>
                ) : (
                  <>
                    <div className="mb-2 text-[28px] font-medium leading-none text-fg-muted">–</div>
                    <div className="text-caption text-fg-muted">{t('kpi.unavailable')}</div>
                  </>
                )
              ) : (
                <>
                  <div className="mb-2 text-[28px] font-medium leading-none text-fg">{card.value}</div>
                  <div className={cn('text-caption', card.attention ? 'font-medium text-danger' : 'text-fg-muted')}>
                    {card.sub}
                  </div>
                </>
              )}
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
