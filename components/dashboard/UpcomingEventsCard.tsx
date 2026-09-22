'use client';

import {useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {AlertCircle, CalendarCheck, CalendarDays, Repeat} from 'lucide-react';
import EventFormModal from '@/app/[locale]/groups/[groupId]/calendar/components/EventFormModal';
import EventViewModal from '@/app/[locale]/groups/[groupId]/calendar/components/EventViewModal';
import {getCalendarCopy} from '@/app/[locale]/groups/[groupId]/calendar/copy';
import {useCalendarData} from '@/app/[locale]/groups/[groupId]/calendar/hooks/useCalendarData';
import type {SupportedLocale} from '@/app/[locale]/groups/[groupId]/calendar/types';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import Badge from '@/components/ui/Badge';
import {useGroupContext} from '@/hooks/useGroupContext';
import {UPCOMING_WINDOW_DAYS, useUpcomingEvents} from '@/hooks/useUpcomingEvents';
import {useAuthStore} from '@/lib/store/authStore';
import type {UpcomingEvent} from '@/lib/types/dashboard';
import {cn} from '@/lib/utils/cn';
import {formatEventTime, getDateLocale} from '@/lib/utils/calendarHelpers';
import {describeDay} from '@/lib/utils/dashboardDates';
import {isOngoing, toEventRecordItem, toOccurrenceItem, upcomingEventKey} from '@/lib/utils/dashboardEvents';
import {DASHBOARD_EVENTS_ANCHOR} from './DashboardKpis';
import {useDashboard} from './DashboardProvider';

/**
 * The next week's events across every group. Rows open the calendar page's own `EventViewModal` (and, from there,
 * `EventFormModal`); the mutations go through the same `useCalendarData` payload mapping the calendar page uses.
 */
export default function UpcomingEventsCard() {
  const t = useTranslations('dashboard.upcoming');
  const locale = useLocale();
  const calendarLocale: SupportedLocale = locale === 'en' ? 'en' : 'hu';
  const user = useAuthStore((s) => s.user);
  const {refreshKeys, refresh} = useDashboard();
  const {events, total, loading, failed, rateLimited, retry} = useUpcomingEvents({
    enabled: !!user,
    refreshKey: refreshKeys.events
  });

  const [selected, setSelected] = useState<UpcomingEvent | null>(null);
  const [phase, setPhase] = useState<'view' | 'edit'>('view');
  const groupContext = useGroupContext(selected?.group_id ?? null, {users: false, sprints: false});
  const copy = useMemo(() => getCalendarCopy(calendarLocale), [calendarLocale]);
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  // Mutations only: the calendars and events are not needed to view, edit or delete a known event.
  const calendarData = useCalendarData({groupId: selected?.group_id ?? '', locale: calendarLocale, enabled: false, copy});

  const occurrenceItem = selected ? toOccurrenceItem(selected) : null;
  const recordItem = selected ? toEventRecordItem(selected) : null;
  const selectedKey = selected ? upcomingEventKey(selected) : null;

  const close = () => {
    setSelected(null);
    setPhase('view');
  };
  const changed = () => {
    close();
    refresh('events', 'summary');
  };

  const now = new Date();
  const dateLocale = getDateLocale(locale);
  const dayNumber = new Intl.DateTimeFormat(dateLocale, {day: 'numeric'});
  const weekday = new Intl.DateTimeFormat(dateLocale, {weekday: 'short'});

  const whenLabel = (event: UpcomingEvent) => {
    const start = new Date(event.occurrence_start_at);
    const day = describeDay(event.occurrence_start_at, now, locale);
    const dayText = !day ? '' : day.bucket === 'today' ? t('today') : day.bucket === 'tomorrow' ? t('tomorrow') : day.day;
    const timeText = event.all_day
      ? t('all_day')
      : `${formatEventTime(start, locale)} – ${formatEventTime(new Date(event.occurrence_end_at), locale)}`;
    return [dayText, timeText, event.group_name, event.location].filter(Boolean).join(' · ');
  };

  const showSkeleton = events === null && !failed;

  return (
    <Card id={DASHBOARD_EVENTS_ANCHOR} className="scroll-mt-4 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-section text-fg">
          <CalendarDays size={16} strokeWidth={1.75} />
          <span>{t('title')}</span>
          {total > 0 && (
            <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-fg-secondary">
              {total}
            </span>
          )}
        </div>
        <span className="text-caption text-fg-muted">{t('window', {days: UPCOMING_WINDOW_DAYS})}</span>
      </div>

      {showSkeleton ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : events === null ? (
        <EmptyState
          icon={<AlertCircle size={20} strokeWidth={1.75} className="text-fg-muted" />}
          action={
            <button type="button" onClick={retry} className="rounded-md px-2 py-1 text-caption text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg">
              {t('retry')}
            </button>
          }
        >
          {rateLimited ? t('rate_limited') : t('error')}
        </EmptyState>
      ) : events.length === 0 ? (
        <EmptyState icon={<CalendarCheck size={20} strokeWidth={1.75} className="text-fg-muted" />}>
          {t('empty', {days: UPCOMING_WINDOW_DAYS})}
        </EmptyState>
      ) : (
        <>
          <ul className={cn('space-y-1 transition-opacity', loading && 'opacity-70')}>
            {events.map((event) => {
              const key = upcomingEventKey(event);
              const start = new Date(event.occurrence_start_at);
              const opening = selectedKey === key && groupContext.loading;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => {
                      setPhase('view');
                      setSelected(event);
                    }}
                    aria-busy={opening}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md p-3 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                      opening && 'opacity-60'
                    )}
                  >
                    <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-md bg-surface-2 text-fg-secondary">
                      <span className="text-[15px] font-semibold leading-none">{dayNumber.format(start)}</span>
                      <span className="mt-0.5 text-[10px] uppercase leading-none">{weekday.format(start)}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-fg">{event.name}</span>
                        {isOngoing(event, now) && <Badge variant="success">{t('ongoing')}</Badge>}
                        {event.rrule && <Repeat size={12} strokeWidth={1.75} aria-label={t('recurring')} className="shrink-0 text-fg-muted" />}
                      </span>
                      <span className="block truncate text-caption text-fg-muted">{whenLabel(event)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {total > events.length && <p className="mt-2 text-caption text-fg-muted">{t('more', {count: total - events.length})}</p>}
        </>
      )}

      {/* The write permission is per group and unknown until that group's own request answers, so the view waits for it. */}
      {occurrenceItem && phase === 'view' && (
        <EventViewModal
          open={!groupContext.loading}
          locale={calendarLocale}
          copy={copy}
          event={occurrenceItem}
          canManageEvents={groupContext.hasPermission('group.calendar.event.write')}
          isDeleting={calendarData.isMutating}
          onClose={close}
          onEdit={() => setPhase('edit')}
          onDelete={async () => {
            await calendarData.deleteEvent(occurrenceItem);
            changed();
          }}
        />
      )}

      {recordItem && phase === 'edit' && (
        <EventFormModal
          open
          mode="edit"
          copy={copy}
          locale={calendarLocale}
          event={recordItem}
          initialRange={null}
          timezone={timezone}
          submitting={calendarData.isMutating}
          onClose={close}
          onSubmit={async (values) => {
            await calendarData.updateEvent(recordItem, values);
            changed();
          }}
        />
      )}
    </Card>
  );
}
