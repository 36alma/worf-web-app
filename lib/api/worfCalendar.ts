import apiClient from '@/lib/api/client';

const JSON_CONTENT_TYPE = 'application/json';

export type WorfCalendarBaseBody = {
  Bearer: string;
  'content-type': typeof JSON_CONTENT_TYPE;
};

export type GetGroupCalendarBody = {
  group_id: string;
};

export type GetGroupCalendarEventBody = {
  group_id: string;
  group_calendar_id: string;
  include_cancelled?: boolean;
};

export type UpsertGroupCalendarEventBody = {
  group_id: string;
  group_calendar_id: string;
  kind: string;
  name: string;
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
  parent_id?: string;
};

export type ModifyGroupCalendarEventBody = UpsertGroupCalendarEventBody & {
  group_calendar_event_id: string;
};

export type DeleteGroupCalendarEventBody = {
  group_id: string;
  group_calendar_id: string;
  group_calendar_event_id: string;
};

function withBase<T extends Record<string, unknown>>(token: string, body: T): WorfCalendarBaseBody & T {
  return {
    Bearer: token,
    'content-type': JSON_CONTENT_TYPE,
    ...body,
  };
}

function ensureToken(token: string) {
  if (!token.trim()) {
    throw new Error('Missing access token. Please sign in again.');
  }
}

export async function postGroupCalendarGet(token: string, body: GetGroupCalendarBody) {
  ensureToken(token);
  return apiClient.post('/v1/group/calendar/get', withBase(token, body));
}

export async function postGroupCalendarEventGet(token: string, body: GetGroupCalendarEventBody) {
  ensureToken(token);
  return apiClient.post('/v1/group/calendar/event/get', withBase(token, body));
}

export async function postGroupCalendarEventCreate(token: string, body: UpsertGroupCalendarEventBody) {
  ensureToken(token);
  return apiClient.post('/v1/group/calendar/event/create', withBase(token, body));
}

export async function postGroupCalendarEventModify(token: string, body: ModifyGroupCalendarEventBody) {
  ensureToken(token);
  return apiClient.post('/v1/group/calendar/event/modify', withBase(token, body));
}

export async function postGroupCalendarEventDelete(token: string, body: DeleteGroupCalendarEventBody) {
  ensureToken(token);
  return apiClient.post('/v1/group/calendar/event/delete', withBase(token, body));
}
