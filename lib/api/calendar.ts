/**
 * Calendar API methods used by GUI hooks/components.
 * Uses the shared apiClient to keep the same auth refresh behavior.
 */

import apiClient from '@/lib/api/client';
import type {
  CreateGlobalCalendarEventPayload,
  CreateGroupCalendarEventPayload,
  CreateGroupCalendarPayload,
  DeleteGlobalCalendarEventPayload,
  DeleteGroupCalendarEventPayload,
  DeleteGroupCalendarPayload,
  GetGroupCalendarEventPayload,
  GetGroupCalendarPayload,
  ModifyGlobalCalendarEventPayload,
  ModifyGroupCalendarEventPayload,
  ModifyGroupCalendarPayload,
} from '@/lib/types/calendar';

export const createGlobalCalendarEvent = (data: CreateGlobalCalendarEventPayload) =>
  apiClient.post('/v1/global/calendar/event/create', data);

export const modifyGlobalCalendarEvent = (data: ModifyGlobalCalendarEventPayload) =>
  apiClient.post('/v1/global/calendar/event/modify', data);

export const deleteGlobalCalendarEvent = (data: DeleteGlobalCalendarEventPayload) =>
  apiClient.post('/v1/global/calendar/event/delete', data);

export const getGroupCalendars = (data: GetGroupCalendarPayload) =>
  apiClient.post('/v1/group/calendar/get', data);

export const createGroupCalendar = (data: CreateGroupCalendarPayload) =>
  apiClient.post('/v1/group/calendar/create', data);

export const modifyGroupCalendar = (data: ModifyGroupCalendarPayload) =>
  apiClient.post('/v1/group/calendar/modify', data);

export const deleteGroupCalendar = (data: DeleteGroupCalendarPayload) =>
  apiClient.post('/v1/group/calendar/delete', data);

export const getGroupCalendarEvents = (data: GetGroupCalendarEventPayload) =>
  apiClient.post('/v1/group/calendar/event/get', data);

export const createGroupCalendarEvent = (data: CreateGroupCalendarEventPayload) =>
  apiClient.post('/v1/group/calendar/event/create', data);

export const modifyGroupCalendarEvent = (data: ModifyGroupCalendarEventPayload) =>
  apiClient.post('/v1/group/calendar/event/modify', data);

export const deleteGroupCalendarEvent = (data: DeleteGroupCalendarEventPayload) =>
  apiClient.post('/v1/group/calendar/event/delete', data);
