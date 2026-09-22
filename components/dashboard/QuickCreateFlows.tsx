'use client';

import {useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {Loader2} from 'lucide-react';
import EventFormModal from '@/app/[locale]/groups/[groupId]/calendar/components/EventFormModal';
import {getCalendarCopy} from '@/app/[locale]/groups/[groupId]/calendar/copy';
import {useCalendarData} from '@/app/[locale]/groups/[groupId]/calendar/hooks/useCalendarData';
import type {SupportedLocale} from '@/app/[locale]/groups/[groupId]/calendar/types';
import {mapCalendarsPayload} from '@/app/[locale]/groups/[groupId]/calendar/utils/calendarMappers';
import PostFormModal from '@/components/posts/PostFormModal';
import TaskFormModal from '@/components/groups/tasks/TaskFormModal';
import {useGroupContext} from '@/hooks/useGroupContext';
import {getGroupCalendars} from '@/lib/api/calendar';

/**
 * The create flows behind the dashboard's quick actions. Each one is mounted for one chosen group: it loads what that
 * group's modal needs, checks the create permission (the server checks again on save), and only then mounts the
 * module's own modal — the same one the group's page uses.
 */
export interface QuickFlowProps {
  groupId: string;
  onClose: () => void;
  /** Something was created — the dashboard refreshes what it may have changed. */
  onDone: () => void;
}

/** While a flow fetches the group's permissions and lookups, so a click is never met with silence. */
function Preparing() {
  const t = useTranslations('dashboard.quick');
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-surface-2 px-4 py-2 text-caption text-fg shadow-lg"
    >
      <Loader2 size={14} className="animate-spin" />
      {t('preparing')}
    </div>
  );
}

/** Reports a group the user may not create in, then ends the flow. */
function useDenied(denied: boolean, onClose: () => void) {
  const t = useTranslations('dashboard.quick');
  useEffect(() => {
    if (!denied) return;
    toast.error(t('no_permission'));
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [denied]);
}

export function TaskCreateFlow({groupId, onClose, onDone}: QuickFlowProps) {
  const ctx = useGroupContext(groupId);
  // The form resets itself whenever the member list changes, which would wipe what was typed — so it waits for it.
  const ready = !ctx.loading && !ctx.groupUsersLoading;
  const allowed = ctx.hasPermission('group.task.create');
  useDenied(ready && !allowed, onClose);

  if (!ready) return <Preparing />;
  if (!allowed) return null;
  return (
    <TaskFormModal
      open
      groupId={groupId}
      groupUsers={ctx.groupUsers}
      sprints={ctx.sprints}
      onSuccess={onDone}
      onClose={onClose}
    />
  );
}

export function EventCreateFlow({groupId, locale, onClose, onDone}: QuickFlowProps & {locale: SupportedLocale}) {
  const t = useTranslations('dashboard.quick');
  const ctx = useGroupContext(groupId, {users: false, sprints: false});
  const copy = useMemo(() => getCalendarCopy(locale), [locale]);
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  // Only the create call is needed; the calendars are looked up below.
  const data = useCalendarData({groupId, locale, enabled: false, copy});
  const allowed = ctx.hasPermission('group.calendar.event.write');
  useDenied(!ctx.loading && !allowed, onClose);

  const [calendars, setCalendars] = useState<{id: string; name: string}[] | null>(null);
  const [calendarId, setCalendarId] = useState('');

  useEffect(() => {
    if (ctx.loading || !allowed) return;
    let mounted = true;
    getGroupCalendars({group_id: groupId})
      .then(({data: payload}) => {
        if (!mounted) return;
        const loaded = mapCalendarsPayload(payload).map((calendar) => ({id: calendar.id, name: calendar.name}));
        if (loaded.length === 0) {
          toast.error(copy.noCalendarTitle);
          onClose();
          return;
        }
        setCalendars(loaded);
        setCalendarId(loaded[0].id);
      })
      .catch(() => {
        if (!mounted) return;
        toast.error(t('open_error'));
        onClose();
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.loading, allowed, groupId]);

  if (ctx.loading || (allowed && !calendars)) return <Preparing />;
  if (!allowed || !calendars) return null;
  return (
    <EventFormModal
      open
      mode="create"
      copy={copy}
      locale={locale}
      event={null}
      initialRange={null}
      timezone={timezone}
      submitting={data.isMutating}
      calendars={calendars}
      calendarId={calendarId}
      onCalendarChange={setCalendarId}
      onClose={onClose}
      onSubmit={async (values) => {
        const id = await data.createEvent(values, calendarId);
        if (id === null) return; // the request failed — the error toast is up, keep the form open
        onDone();
        onClose();
      }}
    />
  );
}

export function PostCreateFlow({groupId, onClose}: QuickFlowProps) {
  const ctx = useGroupContext(groupId, {users: false, sprints: false});
  const allowed = ctx.hasPermission('group.post.create');
  useDenied(!ctx.loading && !allowed, onClose);

  if (ctx.loading) return <Preparing />;
  if (!allowed) return null;
  // Posts feed neither the summary nor the activity list, so nothing on the dashboard needs a refetch.
  return <PostFormModal open mode="create" groupId={groupId} onClose={onClose} />;
}
