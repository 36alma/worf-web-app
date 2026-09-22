import {getTaskPanel, deleteTask} from '@/lib/api/tasks';
import {getGroupCalendars, getGroupCalendarEvents, deleteGroupCalendarEvent} from '@/lib/api/calendar';
import {getGroupPosts, deleteGroupPost} from '@/lib/api/posts';
import {listMinutes, deleteMinutes} from '@/lib/api/minutes';
import {listFiles, deleteFile} from '@/lib/api/files';
import {STATUS_LABELS} from '@/components/groups/tasks/types';
import type {CommandName} from '@/lib/api/palette';

export interface ChipRef {
  type: CommandName;
  id: string;
  label: string;
}

export interface PickerItem extends ChipRef {
  subtitle?: string;
  isOwner?: boolean;
  raw?: Record<string, any>;
}

export interface EditorContext {
  groupId: string;
  locale: string;
  /** The item currently being edited — excluded from `reference` lists (no self-reference). */
  owner?: {type: CommandName; id: string};
}

/**
 * Data side of a `/` command: the pick lists and deletion. Creating, editing and opening a record
 * is done by the app's own modals — see `EntityModalProvider`.
 */
export interface EntityAdapter {
  readonly name: CommandName;
  /** modify/delete pick lists only show rows the user owns (files). */
  readonly ownerOnly?: boolean;
  list(ctx: EditorContext, page: number): Promise<{items: PickerItem[]; hasMore: boolean}>;
  remove?(ctx: EditorContext, item: PickerItem): Promise<void>;
}

const PAGE_SIZE = 50;

const str = (value: unknown, fallback = ''): string => (value == null ? fallback : String(value));

const formatDate = (iso: unknown): string | undefined => {
  const value = str(iso);
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toLocaleString();
};

// ---------------------------------------------------------------- task

const taskAdapter: EntityAdapter = {
  name: 'task',
  async list(ctx, page) {
    const {data} = await getTaskPanel({group_id: ctx.groupId, page_number: page, load_task_number: PAGE_SIZE});
    const tasks = (data?.tasks ?? []) as Record<string, any>[];
    return {
      items: tasks.map((task) => ({
        type: 'task' as const,
        id: str(task.id),
        label: `${str(task.issue_key)} · ${str(task.summary)}`,
        subtitle: str(task.status) ? (STATUS_LABELS as Record<string, string>)[task.status] ?? str(task.status) : undefined,
        raw: task
      })),
      hasMore: Number(data?.current_page ?? page) < Number(data?.total_pages ?? page)
    };
  },
  async remove(ctx, item) {
    await deleteTask({group_id: ctx.groupId, task_id: [item.id]});
  }
};

// ---------------------------------------------------------------- event

/** The group's calendars — the create form picks one, the lookup below scans them all. */
export async function loadCalendars(ctx: Pick<EditorContext, 'groupId'>): Promise<{id: string; name: string}[]> {
  const {data} = await getGroupCalendars({group_id: ctx.groupId});
  return ((data?.group_calendars ?? []) as Record<string, any>[]).map((c) => ({
    id: str(c.group_calendar_id),
    name: str(c.calendar_name, str(c.group_calendar_id))
  }));
}

/** Every event of every group calendar; `raw` carries the event row plus its `group_calendar_id`. */
export async function loadEvents(ctx: Pick<EditorContext, 'groupId'>): Promise<PickerItem[]> {
  const calendars = await loadCalendars(ctx);
  const perCalendar = await Promise.all(
    calendars.map(async (calendar) => {
      const {data} = await getGroupCalendarEvents({group_id: ctx.groupId, group_calendar_id: calendar.id});
      return ((data?.group_calendar_events ?? []) as Record<string, any>[]).map((event) => ({
        type: 'event' as const,
        id: str(event.group_calendar_event_id),
        label: str(event.name),
        subtitle: [calendar.name, formatDate(event.start_at)].filter(Boolean).join(' · '),
        raw: {...event, group_calendar_id: calendar.id}
      }));
    })
  );
  return perCalendar.flat();
}

const eventAdapter: EntityAdapter = {
  name: 'event',
  async list(ctx) {
    return {items: await loadEvents(ctx), hasMore: false};
  },
  async remove(ctx, item) {
    await deleteGroupCalendarEvent({
      group_id: ctx.groupId,
      group_calendar_id: str(item.raw?.group_calendar_id),
      group_calendar_event_id: item.id
    });
  }
};

// ---------------------------------------------------------------- post

const postAdapter: EntityAdapter = {
  name: 'post',
  async list(ctx, page) {
    const {data} = await getGroupPosts({group_id: ctx.groupId, page_number: page, load_post_number: PAGE_SIZE});
    const rows = (data?.posts ?? []) as Record<string, any>[];
    return {
      items: rows.map((row) => {
        const post = (row.post ?? row) as Record<string, any>;
        return {
          type: 'post' as const,
          id: str(post.post_id ?? post.id),
          label: str(post.title),
          subtitle: str(row.category?.name) || undefined,
          raw: post
        };
      }),
      hasMore: Number(data?.current_page ?? page) < Number(data?.total_pages ?? page)
    };
  },
  async remove(ctx, item) {
    await deleteGroupPost(ctx.groupId, item.id);
  }
};

// ---------------------------------------------------------------- minutes

const minutesAdapter: EntityAdapter = {
  name: 'minutes',
  async list(ctx, page) {
    const {data} = await listMinutes({group_id: ctx.groupId, page_number: page, load_number: PAGE_SIZE});
    const rows = (data?.minutes ?? []) as Record<string, any>[];
    return {
      items: rows.map((m) => ({
        type: 'minutes' as const,
        id: str(m.id ?? m.minutes_id),
        label: str(m.subject),
        subtitle: formatDate(m.meeting_date),
        raw: m
      })),
      hasMore: Number(data?.current_page ?? page) < Number(data?.total_pages ?? page)
    };
  },
  async remove(ctx, item) {
    await deleteMinutes({group_id: ctx.groupId, minutes_id: item.id});
  }
};

// ---------------------------------------------------------------- file

const fileAdapter: EntityAdapter = {
  name: 'file',
  ownerOnly: true,
  async list(ctx, page) {
    const offset = (page - 1) * PAGE_SIZE;
    const {data} = await listFiles({scope: 'group', group_id: ctx.groupId, offset, limit: PAGE_SIZE});
    return {
      items: data.items.map((file) => ({
        type: 'file' as const,
        id: file.id,
        label: file.original_name,
        subtitle: formatDate(file.uploaded_at),
        isOwner: file.is_owner,
        raw: file as unknown as Record<string, any>
      })),
      hasMore: offset + data.items.length < data.total
    };
  },
  async remove(_ctx, item) {
    await deleteFile(item.id);
  }
};

export const ENTITY_ADAPTERS: Record<CommandName, EntityAdapter> = {
  task: taskAdapter,
  event: eventAdapter,
  post: postAdapter,
  minutes: minutesAdapter,
  file: fileAdapter
};
