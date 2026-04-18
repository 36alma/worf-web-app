/** Business service layer for calendars/events with validation and rate-limit checks. */
import { z } from 'zod';
import { CalendarApi } from '@/src/api/calendarApi';
import type {
  CreateGlobalGroupCalendarEventRequest,
  CreateGroupCalendarEventRequest,
  CreateGroupCalendarRequest,
  DeleteGlobalGroupCalendarEventRequest,
  DeleteGroupCalendarEventRequest,
  DeleteGroupCalendarRequest,
  GetGroupCalendarEventRequest,
  GetGroupCalendarRequest,
  GroupCalendar,
  GroupCalendarEvent,
  ModifyGlobalGroupCalendarEventRequest,
  ModifyGroupCalendarEventRequest,
  ModifyGroupCalendarRequest
} from '@/src/types/calendar.types';
import { ApiEnvelopeSchema as EnvelopeSchema } from '@/src/types/calendar.types';
import { notifyError, RateLimitError } from '@/src/utils/errorHandler';
import { ClientRateLimiter, type RateLimitCategory } from '@/src/utils/rateLimiter';

type Envelope = z.infer<typeof EnvelopeSchema>;

const toRecord = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});
const toString = (value: unknown): string => (value == null ? '' : String(value));
const toBoolean = (value: unknown): boolean => value === true || value === 1 || value === '1' || value === 'true';
const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};
const toNullableString = (value: unknown): string | null => {
  const str = toString(value).trim();
  return str ? str : null;
};

const readDataArray = (response: Envelope): unknown[] => {
  const data = response.data;
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  const record = data as Record<string, unknown>;
  const arrayCandidate = ['items', 'rows', 'result', 'events', 'calendars', 'data'].map((key) => record[key]).find(Array.isArray);
  return Array.isArray(arrayCandidate) ? arrayCandidate : [];
};

export class CalendarService {
  private readonly limiter = new ClientRateLimiter();
  private readonly onError: (error: unknown) => void;

  constructor(private readonly api: CalendarApi, onError?: (error: unknown) => void) {
    this.onError = onError ?? notifyError;
  }

  /** Returns client-side rate-limit status for a category. */
  getRateLimitStatus(category: RateLimitCategory) {
    return this.limiter.getStatus(category);
  }

  private async withRateLimit<T>(category: RateLimitCategory, action: () => Promise<T>): Promise<T> {
    if (!this.limiter.canProceed(category)) {
      const status = this.limiter.getStatus(category);
      const error = new RateLimitError(`Local rate limit reached. Retry in ${Math.ceil(status.resetInMs / 1000)}s.`);
      this.onError(error);
      throw error;
    }
    this.limiter.record(category);
    try {
      return await action();
    } catch (error) {
      this.onError(error);
      throw error;
    }
  }

  private parseEnvelope(value: unknown): Envelope {
    return EnvelopeSchema.parse(value);
  }

  private mapCalendars(value: unknown, fallbackGroupId: string): GroupCalendar[] {
    return readDataArray(this.parseEnvelope(value))
      .map((item) => {
        const row = toRecord(item);
        const id = toString(row.group_calendar_id ?? row.calendar_id ?? row.id).trim();
        if (!id) return null;
        return {
          id,
          groupId: toString(row.group_id ?? fallbackGroupId),
          name: toString(row.calendar_name ?? row.name ?? id),
          description: toNullableString(row.calendar_description ?? row.description),
          raw: row
        } satisfies GroupCalendar;
      })
      .filter((row): row is GroupCalendar => Boolean(row));
  }

  private mapEvents(value: unknown, fallbackGroupId: string, fallbackCalendarId: string): GroupCalendarEvent[] {
    return readDataArray(this.parseEnvelope(value))
      .map((item) => {
        const row = toRecord(item);
        const id = toString(row.group_calendar_event_id ?? row.event_id ?? row.id).trim();
        if (!id) return null;
        return {
          id,
          groupId: toString(row.group_id ?? fallbackGroupId),
          calendarId: toString(row.group_calendar_id ?? row.calendar_id ?? fallbackCalendarId),
          kind: toString(row.kind ?? 'event'),
          name: toString(row.name ?? row.title ?? id),
          parentId: toNullableString(row.parent_id),
          location: toNullableString(row.location),
          allDay: toBoolean(row.all_day),
          startAt: toNullableString(row.start_at),
          endAt: toNullableString(row.end_at),
          rrule: toNullableString(row.rrule),
          untilAt: toNullableString(row.until_at),
          countN: toNumberOrNull(row.count_n),
          originalStartAt: toNullableString(row.original_start_at),
          isCancelled: toBoolean(row.is_cancelled),
          timezone: toNullableString(row.timezone),
          isGlobal: toBoolean(row.is_global),
          raw: row
        } satisfies GroupCalendarEvent;
      })
      .filter((row): row is GroupCalendarEvent => Boolean(row));
  }

  /** Creates a new group calendar. */
  async createGroupCalendar(payload: CreateGroupCalendarRequest): Promise<void> {
    await this.withRateLimit('calendar_mutate', () => this.api.createGroupCalendar(payload));
  }

  /** Fetches calendars for a group. */
  async getGroupCalendars(payload: GetGroupCalendarRequest): Promise<GroupCalendar[]> {
    const response = await this.withRateLimit('calendar_get', () => this.api.getGroupCalendar(payload));
    return this.mapCalendars(response, payload.group_id);
  }

  /** Modifies an existing group calendar. */
  async modifyGroupCalendar(payload: ModifyGroupCalendarRequest): Promise<void> {
    await this.withRateLimit('calendar_mutate', () => this.api.modifyGroupCalendar(payload));
  }

  /** Deletes an existing group calendar. */
  async deleteGroupCalendar(payload: DeleteGroupCalendarRequest): Promise<void> {
    await this.withRateLimit('calendar_mutate', () => this.api.deleteGroupCalendar(payload));
  }

  /** Creates a group calendar event. */
  async createGroupCalendarEvent(payload: CreateGroupCalendarEventRequest): Promise<void> {
    await this.withRateLimit('event_mutate', () => this.api.createGroupCalendarEvent(payload));
  }

  /** Fetches group calendar events. */
  async getGroupCalendarEvents(payload: GetGroupCalendarEventRequest): Promise<GroupCalendarEvent[]> {
    const response = await this.withRateLimit('event_get', () => this.api.getGroupCalendarEvent(payload));
    return this.mapEvents(response, payload.group_id, payload.group_calendar_id);
  }

  /** Modifies a group calendar event. */
  async modifyGroupCalendarEvent(payload: ModifyGroupCalendarEventRequest): Promise<void> {
    await this.withRateLimit('event_mutate', () => this.api.modifyGroupCalendarEvent(payload));
  }

  /** Deletes a group calendar event. */
  async deleteGroupCalendarEvent(payload: DeleteGroupCalendarEventRequest): Promise<void> {
    await this.withRateLimit('event_mutate', () => this.api.deleteGroupCalendarEvent(payload));
  }

  /** Creates a global calendar event. */
  async createGlobalCalendarEvent(payload: CreateGlobalGroupCalendarEventRequest): Promise<void> {
    await this.withRateLimit('event_mutate', () => this.api.createGlobalCalendarEvent(payload));
  }

  /** Modifies a global calendar event. */
  async modifyGlobalCalendarEvent(payload: ModifyGlobalGroupCalendarEventRequest): Promise<void> {
    await this.withRateLimit('event_mutate', () => this.api.modifyGlobalCalendarEvent(payload));
  }

  /** Deletes a global calendar event. */
  async deleteGlobalCalendarEvent(payload: DeleteGlobalGroupCalendarEventRequest): Promise<void> {
    await this.withRateLimit('event_mutate', () => this.api.deleteGlobalCalendarEvent(payload));
  }
}
