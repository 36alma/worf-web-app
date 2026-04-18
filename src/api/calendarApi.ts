/** Calendar endpoint methods grouped in a thin API class. */
import { ApiClient } from '@/src/api/client';
import type {
  ApiResponse,
  CreateGlobalGroupCalendarEventRequest,
  CreateGroupCalendarEventRequest,
  CreateGroupCalendarRequest,
  DeleteGlobalGroupCalendarEventRequest,
  DeleteGroupCalendarEventRequest,
  DeleteGroupCalendarRequest,
  GetGroupCalendarEventRequest,
  GetGroupCalendarRequest,
  ModifyGlobalGroupCalendarEventRequest,
  ModifyGroupCalendarEventRequest,
  ModifyGroupCalendarRequest
} from '@/src/types/calendar.types';

export class CalendarApi {
  constructor(private readonly client: ApiClient) {}

  /** Calls POST /v1/group/calendar/create. */
  createGroupCalendar(payload: CreateGroupCalendarRequest) {
    return this.client.postWithRetry<ApiResponse, CreateGroupCalendarRequest>('/v1/group/calendar/create', payload);
  }

  /** Calls POST /v1/group/calendar/get. */
  getGroupCalendar(payload: GetGroupCalendarRequest) {
    return this.client.postWithRetry<ApiResponse, GetGroupCalendarRequest>('/v1/group/calendar/get', payload);
  }

  /** Calls POST /v1/group/calendar/modify. */
  modifyGroupCalendar(payload: ModifyGroupCalendarRequest) {
    return this.client.postWithRetry<ApiResponse, ModifyGroupCalendarRequest>('/v1/group/calendar/modify', payload);
  }

  /** Calls POST /v1/group/calendar/delete. */
  deleteGroupCalendar(payload: DeleteGroupCalendarRequest) {
    return this.client.postWithRetry<ApiResponse, DeleteGroupCalendarRequest>('/v1/group/calendar/delete', payload);
  }

  /** Calls POST /v1/group/calendar/event/create. */
  createGroupCalendarEvent(payload: CreateGroupCalendarEventRequest) {
    return this.client.postWithRetry<ApiResponse, CreateGroupCalendarEventRequest>('/v1/group/calendar/event/create', payload);
  }

  /** Calls POST /v1/group/calendar/event/get. */
  getGroupCalendarEvent(payload: GetGroupCalendarEventRequest) {
    return this.client.postWithRetry<ApiResponse, GetGroupCalendarEventRequest>('/v1/group/calendar/event/get', payload);
  }

  /** Calls POST /v1/group/calendar/event/modify. */
  modifyGroupCalendarEvent(payload: ModifyGroupCalendarEventRequest) {
    return this.client.postWithRetry<ApiResponse, ModifyGroupCalendarEventRequest>('/v1/group/calendar/event/modify', payload);
  }

  /** Calls POST /v1/group/calendar/event/delete. */
  deleteGroupCalendarEvent(payload: DeleteGroupCalendarEventRequest) {
    return this.client.postWithRetry<ApiResponse, DeleteGroupCalendarEventRequest>('/v1/group/calendar/event/delete', payload);
  }

  /** Calls POST /v1/global/calendar/event/create. */
  createGlobalCalendarEvent(payload: CreateGlobalGroupCalendarEventRequest) {
    return this.client.postWithRetry<ApiResponse, CreateGlobalGroupCalendarEventRequest>('/v1/global/calendar/event/create', payload);
  }

  /** Calls POST /v1/global/calendar/event/modify. */
  modifyGlobalCalendarEvent(payload: ModifyGlobalGroupCalendarEventRequest) {
    return this.client.postWithRetry<ApiResponse, ModifyGlobalGroupCalendarEventRequest>('/v1/global/calendar/event/modify', payload);
  }

  /** Calls POST /v1/global/calendar/event/delete. */
  deleteGlobalCalendarEvent(payload: DeleteGlobalGroupCalendarEventRequest) {
    return this.client.postWithRetry<ApiResponse, DeleteGlobalGroupCalendarEventRequest>('/v1/global/calendar/event/delete', payload);
  }
}
