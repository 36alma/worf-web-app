import apiClient from './client';

export const getGlobalCalendarEvents = (data: {from?: string; to?: string}) =>
  apiClient.post('/v1/global/calendar/event/get', data);

export const createGlobalCalendarEvent = (data: Record<string, unknown>) =>
  apiClient.post('/v1/global/calendar/event/create', data);

export const modifyGlobalCalendarEvent = (data: Record<string, unknown>) =>
  apiClient.post('/v1/global/calendar/event/modify', data);

export const deleteGlobalCalendarEvent = (event_id: string) =>
  apiClient.post('/v1/global/calendar/event/delete', {event_id});

export const getGroupCalendars = (group_id: string) =>
  apiClient.post('/v1/group/calendar/get', {group_id});

export const createGroupCalendar = (data: {group_id: string; name: string}) =>
  apiClient.post('/v1/group/calendar/create', data);

export const getGroupCalendarEvents = (data: {group_id: string; calendar_id?: string}) =>
  apiClient.post('/v1/group/calendar/event/get', data);
