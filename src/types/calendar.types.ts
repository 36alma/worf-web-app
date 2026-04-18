/** Calendar API models, schemas, and shared domain types. */
import { z } from 'zod';

export type ISODateTimeString = string;

export const NullableStringSchema = z.string().nullable().optional();
export const NullableBooleanSchema = z.boolean().nullable().optional();
export const NullableNumberSchema = z.number().int().nullable().optional();

export const ApiEnvelopeSchema = z
  .object({
    data: z.unknown().optional(),
    message: z.string().optional(),
    error: z.string().optional()
  })
  .passthrough();

export interface CreateGroupCalendarRequest {
  Bearer: string;
  group_id: string;
  calendar_name: string;
  group_role_id?: string | null;
  calendar_description?: string | null;
}

export interface GetGroupCalendarRequest {
  Bearer: string;
  group_id: string;
  group_role_id?: string | null;
}

export interface ModifyGroupCalendarRequest {
  Bearer: string;
  group_id: string;
  group_calendar_id: string;
  group_role_id?: string | null;
  calendar_name?: string | null;
  calendar_description?: string | null;
}

export interface DeleteGroupCalendarRequest {
  Bearer: string;
  group_id: string;
  group_calendar_id: string;
  group_role_id?: string | null;
}

export interface CreateGroupCalendarEventRequest {
  Bearer: string;
  group_id: string;
  group_calendar_id: string;
  kind: string;
  name: string;
  group_role_id?: string | null;
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

export interface GetGroupCalendarEventRequest {
  Bearer: string;
  group_id: string;
  group_calendar_id: string;
  group_role_id?: string | null;
  include_cancelled?: boolean;
  only_global?: boolean;
}

export interface ModifyGroupCalendarEventRequest extends Omit<CreateGroupCalendarEventRequest, 'group_calendar_id' | 'kind' | 'name'> {
  group_calendar_id: string;
  group_calendar_event_id: string;
  calendar_id?: string;
  kind?: string;
  name?: string;
}

export interface DeleteGroupCalendarEventRequest {
  Bearer: string;
  group_id: string;
  group_calendar_id: string;
  group_calendar_event_id: string;
  group_role_id?: string | null;
}

export interface CreateGlobalGroupCalendarEventRequest extends Omit<CreateGroupCalendarEventRequest, 'is_global'> {}

export interface ModifyGlobalGroupCalendarEventRequest extends Omit<ModifyGroupCalendarEventRequest, 'is_global'> {}

export interface DeleteGlobalGroupCalendarEventRequest {
  Bearer: string;
  group_calendar_event_id: string;
}

export interface GroupCalendar {
  id: string;
  groupId: string;
  name: string;
  description: string | null;
  raw: Record<string, unknown>;
}

export interface GroupCalendarEvent {
  id: string;
  groupId: string;
  calendarId: string;
  kind: string;
  name: string;
  parentId: string | null;
  location: string | null;
  allDay: boolean;
  startAt: string | null;
  endAt: string | null;
  rrule: string | null;
  untilAt: string | null;
  countN: number | null;
  originalStartAt: string | null;
  isCancelled: boolean;
  timezone: string | null;
  isGlobal: boolean;
  raw: Record<string, unknown>;
}

export interface ApiResponse<TData = unknown> {
  data: TData;
  message?: string;
  error?: string;
}

export type CalendarViewMode = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';
export type RecurringScope = 'single' | 'future' | 'all';
export type EventScopeFilter = 'all' | 'group' | 'global';
