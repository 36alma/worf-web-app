export type SupportedLocale = 'hu' | 'en';
export type EventKind = 'event' | 'task' | 'reminder' | 'birthday';
export type RepeatFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type RepeatEnds = 'until' | 'count';
export type CalendarViewMode = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';

export interface GroupCalendarItem {
  id: string;
  name: string;
  description: string | null;
  raw: Record<string, unknown>;
}

export interface GroupCalendarEventItem {
  id: string;
  calendarId: string;
  name: string;
  kind: EventKind;
  location: string | null;
  allDay: boolean;
  startAt: string | null;
  endAt: string | null;
  timezone: string | null;
  rrule: string | null;
  untilAt: string | null;
  countN: number | null;
  isGlobal: boolean;
  isCancelled: boolean;
  raw: Record<string, unknown>;
}

export interface EventDraftRange {
  startAt: string | null;
  endAt: string | null;
  allDay: boolean;
}

export interface EventFormValues {
  name: string;
  kind: EventKind;
  allDay: boolean;
  startAt: string;
  endAt: string;
  location: string;
  timezone: string;
  repeatEnabled: boolean;
  repeatFrequency: RepeatFrequency;
  repeatEnds: RepeatEnds;
  untilAt: string;
  countN: string;
}

export interface CalendarFormValues {
  calendarName: string;
  calendarDescription: string;
}

export interface CalendarPermissionsState {
  isLoading: boolean;
  userPermissions: Record<string, boolean>;
  groupPermissions: Record<string, boolean>;
  canRead: boolean;
  canManageEvents: boolean;
  canManageCalendars: boolean;
}

export interface CalendarCopy {
  title: string;
  subtitle: string;
  loading: string;
  loadingEvents: string;
  emptyTitle: string;
  emptyDescription: string;
  noCalendarTitle: string;
  noCalendarDescription: string;
  createCalendar: string;
  editCalendar: string;
  deleteCalendar: string;
  createEvent: string;
  editEvent: string;
  deleteEvent: string;
  close: string;
  cancel: string;
  save: string;
  confirm: string;
  today: string;
  month: string;
  week: string;
  day: string;
  calendarLabel: string;
  selectCalendar: string;
  eventDetails: string;
  eventName: string;
  eventKind: string;
  eventStart: string;
  eventEnd: string;
  eventLocation: string;
  eventTimezone: string;
  eventDeleted: string;
  optionalFields: string;
  addOptionalFields: string;
  repeatLabel: string;
  repeatUntil: string;
  repeatCount: string;
  repeatFrequency: string;
  allDay: string;
  calendarName: string;
  calendarDescription: string;
  validationName: string;
  validationKind: string;
  validationStartEnd: string;
  validationRepeatUntil: string;
  validationRepeatCount: string;
  addSelectionHint: string;
  deletedEventLabel: string;
  deleteEventPrompt: string;
  deleteCalendarPrompt: string;
  toasts: {
    calendarCreated: string;
    calendarUpdated: string;
    calendarDeleted: string;
    eventCreated: string;
    eventUpdated: string;
    eventDeleted: string;
    rateLimited: string;
  };
  kindLabels: Record<EventKind, string>;
  repeatFrequencyLabels: Record<RepeatFrequency, string>;
  emptyValue: string;
}
