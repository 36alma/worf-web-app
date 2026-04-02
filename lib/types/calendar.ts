export type CalendarScope = 'group' | 'global';

export interface GroupCalendar {
  id: string;
  groupId: string;
  name: string;
  description?: string;
  raw: Record<string, unknown>;
}

export interface GroupCalendarEvent {
  id: string;
  groupId: string;
  groupCalendarId: string;
  name: string;
  kind: string;
  parentId?: string;
  location?: string;
  allDay: boolean;
  startAt?: string;
  endAt?: string;
  rrule?: string;
  untilAt?: string;
  countN?: number;
  originalStartAt?: string;
  isCancelled: boolean;
  timezone?: string;
  isGlobal: boolean;
  raw: Record<string, unknown>;
}

export interface GroupOption {
  id: string;
  name: string;
}

export interface CreateGroupCalendarPayload {
  group_id: string;
  group_role_id?: string;
  calendar_name: string;
  calendar_description?: string;
}

export interface ModifyGroupCalendarPayload {
  group_id: string;
  group_role_id?: string;
  group_calendar_id: string;
  calendar_name?: string;
  calendar_description?: string;
}

export interface DeleteGroupCalendarPayload {
  group_id: string;
  group_role_id?: string;
  group_calendar_id: string;
}

export interface GetGroupCalendarPayload {
  group_id: string;
  group_role_id?: string;
}

export interface EventMutationFields {
  kind?: string;
  name?: string;
  parent_id?: string;
  location?: string;
  all_day?: boolean;
  start_at?: string;
  end_at?: string;
  rrule?: string;
  until_at?: string;
  count_n?: number;
  original_start_at?: string;
  is_cancelled?: boolean;
  timezone?: string;
  is_global?: boolean;
}

export interface CreateGroupCalendarEventPayload extends EventMutationFields {
  group_id: string;
  group_role_id?: string;
  group_calendar_id: string;
  kind: string;
  name: string;
}

export interface ModifyGroupCalendarEventPayload extends EventMutationFields {
  group_id: string;
  group_role_id?: string;
  group_calendar_id: string;
  group_calendar_event_id: string;
  calendar_id?: string;
}

export interface DeleteGroupCalendarEventPayload {
  group_id: string;
  group_role_id?: string;
  group_calendar_id: string;
  group_calendar_event_id: string;
}

export interface GetGroupCalendarEventPayload {
  group_id: string;
  group_role_id?: string;
  group_calendar_id: string;
  include_cancelled?: boolean;
  only_global?: boolean;
}

export interface CreateGlobalCalendarEventPayload extends EventMutationFields {
  group_id: string;
  group_role_id?: string;
  group_calendar_id: string;
  kind: string;
  name: string;
}

export interface ModifyGlobalCalendarEventPayload extends EventMutationFields {
  group_id: string;
  group_role_id?: string;
  group_calendar_id: string;
  group_calendar_event_id: string;
  calendar_id?: string;
}

export interface DeleteGlobalCalendarEventPayload {
  group_calendar_event_id: string;
}

export interface CalendarMutationInput {
  scope: CalendarScope;
  groupId: string;
  groupCalendarId: string;
  eventId?: string;
  data: EventMutationFields & {
    kind: string;
    name: string;
  };
}
