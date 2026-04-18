/**
 * Calendar API request/response types used by GUI calendar modules.
 */

export type ISODateTimeString = string;

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

export interface EventMutationFields {
  kind?: string;
  name?: string;
  parent_id?: string | null;
  location?: string | null;
  all_day?: boolean;
  start_at?: ISODateTimeString | null;
  end_at?: ISODateTimeString | null;
  rrule?: string | null;
  until_at?: ISODateTimeString | null;
  count_n?: number | null;
  original_start_at?: ISODateTimeString | null;
  is_cancelled?: boolean;
  timezone?: string | null;
  is_global?: boolean;
}

export interface CreateGroupCalendarPayload {
  group_id: string;
  calendar_name: string;
  group_role_id?: string | null;
  calendar_description?: string | null;
}

export interface GetGroupCalendarPayload {
  group_id: string;
  group_role_id?: string | null;
}

export interface ModifyGroupCalendarPayload {
  group_id: string;
  group_calendar_id: string;
  group_role_id?: string | null;
  calendar_name?: string | null;
  calendar_description?: string | null;
}

export interface DeleteGroupCalendarPayload {
  group_id: string;
  group_calendar_id: string;
  group_role_id?: string | null;
}

export interface CreateGroupCalendarEventPayload extends EventMutationFields {
  group_id: string;
  group_calendar_id: string;
  kind: string;
  name: string;
  group_role_id?: string | null;
}

export interface GetGroupCalendarEventPayload {
  group_id: string;
  group_calendar_id: string;
  group_role_id?: string | null;
  include_cancelled?: boolean;
  only_global?: boolean;
}

export interface ModifyGroupCalendarEventPayload extends EventMutationFields {
  group_id: string;
  group_calendar_id: string;
  group_calendar_event_id: string;
  group_role_id?: string | null;
  calendar_id?: string;
}

export interface DeleteGroupCalendarEventPayload {
  group_id: string;
  group_calendar_id: string;
  group_calendar_event_id: string;
  group_role_id?: string | null;
}

export interface CreateGlobalCalendarEventPayload extends EventMutationFields {
  group_id: string;
  group_calendar_id: string;
  kind: string;
  name: string;
  group_role_id?: string | null;
}

export interface ModifyGlobalCalendarEventPayload extends EventMutationFields {
  group_id: string;
  group_calendar_id: string;
  group_calendar_event_id: string;
  group_role_id?: string | null;
  calendar_id?: string;
}

export interface DeleteGlobalCalendarEventPayload {
  group_calendar_event_id: string;
}
