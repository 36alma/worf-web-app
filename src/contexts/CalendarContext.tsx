/** Calendar provider and Zustand-backed state/actions for UI integration. */
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import { createStore, useStore } from 'zustand';
import { ApiClient } from '@/src/api/client';
import { CalendarApi } from '@/src/api/calendarApi';
import { CalendarService } from '@/src/services/calendarService';
import type {
  CalendarState,
  CalendarCacheEntry
} from '@/src/types/ui.types';
import type {
  EventScopeFilter,
  GroupCalendar,
  GroupCalendarEvent,
  ModifyGroupCalendarEventRequest
} from '@/src/types/calendar.types';

type CalendarStore = CalendarState & {
  service: CalendarService;
  token: string;
  setSelectedCalendar: (calendarId: string | null) => void;
  loadCalendars: (groupId?: string) => Promise<void>;
  loadEvents: (calendarId: string, options?: { includeCancelled?: boolean; onlyGlobal?: boolean }) => Promise<void>;
  createCalendar: (input: { groupId?: string; name: string; description?: string | null; groupRoleId?: string | null }) => Promise<void>;
  updateCalendar: (input: {
    groupId?: string;
    calendarId: string;
    name?: string | null;
    description?: string | null;
    groupRoleId?: string | null;
  }) => Promise<void>;
  deleteCalendar: (input: { groupId?: string; calendarId: string; groupRoleId?: string | null }) => Promise<void>;
  createEvent: (input: {
    groupId?: string;
    calendarId: string;
    event: {
      kind: string;
      name: string;
      location?: string | null;
      all_day?: boolean;
      start_at?: string | null;
      end_at?: string | null;
      rrule?: string | null;
      until_at?: string | null;
      count_n?: number | null;
      timezone?: string | null;
      parent_id?: string | null;
      original_start_at?: string | null;
      is_cancelled?: boolean;
      is_global?: boolean;
      group_role_id?: string | null;
    };
  }) => Promise<void>;
  updateEvent: (input: {
    groupId?: string;
    calendarId: string;
    eventId: string;
    updates: Omit<ModifyGroupCalendarEventRequest, 'Bearer' | 'group_id' | 'group_calendar_id' | 'group_calendar_event_id'>;
    isGlobal?: boolean;
  }) => Promise<void>;
  deleteEvent: (input: { groupId?: string; calendarId: string; eventId: string; isGlobal?: boolean }) => Promise<void>;
  getCachedEvents: (calendarId: string, scope?: EventScopeFilter) => GroupCalendarEvent[];
};

const cacheTtlMs = 90_000;

export const createCalendarStore = (groupId: string, token: string, service: CalendarService) =>
  createStore<CalendarStore>((set, get) => ({
    groupId,
    token,
    selectedCalendarId: null,
    calendars: [],
    eventsByCalendar: {},
    calendarsState: { loading: false, error: null, data: [] },
    eventsState: { loading: false, error: null, data: [] },
    pendingMutations: 0,
    service,
    setSelectedCalendar: (calendarId) => set({ selectedCalendarId: calendarId }),
    loadCalendars: async (groupIdOverride) => {
      const effectiveGroupId = groupIdOverride ?? get().groupId;
      set((state) => ({ calendarsState: { ...state.calendarsState, loading: true, error: null } }));
      try {
        const calendars = await get().service.getGroupCalendars({
          Bearer: get().token,
          group_id: effectiveGroupId
        });
        const selected = get().selectedCalendarId;
        set({
          calendars,
          calendarsState: { loading: false, error: null, data: calendars },
          selectedCalendarId: selected && calendars.some((c) => c.id === selected) ? selected : calendars[0]?.id ?? null
        });
      } catch (error) {
        set((state) => ({
          calendarsState: { ...state.calendarsState, loading: false, error: error instanceof Error ? error.message : 'Failed to load calendars' }
        }));
      }
    },
    loadEvents: async (calendarId, options) => {
      const cache = get().eventsByCalendar[calendarId];
      if (cache?.fetchedAt && Date.now() - cache.fetchedAt < cacheTtlMs && !options?.includeCancelled && !options?.onlyGlobal) {
        set((state) => ({ eventsState: { ...state.eventsState, data: cache.events, loading: false, error: null } }));
        return;
      }

      set((state) => ({ eventsState: { ...state.eventsState, loading: true, error: null } }));
      try {
        const events = await get().service.getGroupCalendarEvents({
          Bearer: get().token,
          group_id: get().groupId,
          group_calendar_id: calendarId,
          include_cancelled: options?.includeCancelled,
          only_global: options?.onlyGlobal
        });
        const nextCache: CalendarCacheEntry = { events, fetchedAt: Date.now() };
        set((state) => ({
          eventsByCalendar: { ...state.eventsByCalendar, [calendarId]: nextCache },
          eventsState: { loading: false, error: null, data: events }
        }));
      } catch (error) {
        set((state) => ({
          eventsState: { ...state.eventsState, loading: false, error: error instanceof Error ? error.message : 'Failed to load events' }
        }));
      }
    },
    createCalendar: async (input) => {
      await get().service.createGroupCalendar({
        Bearer: get().token,
        group_id: input.groupId ?? get().groupId,
        calendar_name: input.name,
        calendar_description: input.description ?? null,
        group_role_id: input.groupRoleId ?? null
      });
      await get().loadCalendars(input.groupId);
    },
    updateCalendar: async (input) => {
      await get().service.modifyGroupCalendar({
        Bearer: get().token,
        group_id: input.groupId ?? get().groupId,
        group_calendar_id: input.calendarId,
        calendar_name: input.name,
        calendar_description: input.description,
        group_role_id: input.groupRoleId ?? null
      });
      await get().loadCalendars(input.groupId);
    },
    deleteCalendar: async (input) => {
      await get().service.deleteGroupCalendar({
        Bearer: get().token,
        group_id: input.groupId ?? get().groupId,
        group_calendar_id: input.calendarId,
        group_role_id: input.groupRoleId ?? null
      });
      set((state) => {
        const next: Record<string, CalendarCacheEntry> = { ...state.eventsByCalendar };
        delete next[input.calendarId];
        return { eventsByCalendar: next };
      });
      await get().loadCalendars(input.groupId);
    },
    createEvent: async (input) => {
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticEvent: GroupCalendarEvent = {
        id: optimisticId,
        groupId: input.groupId ?? get().groupId,
        calendarId: input.calendarId,
        kind: input.event.kind,
        name: input.event.name,
        parentId: input.event.parent_id ?? null,
        location: input.event.location ?? null,
        allDay: Boolean(input.event.all_day),
        startAt: input.event.start_at ?? null,
        endAt: input.event.end_at ?? null,
        rrule: input.event.rrule ?? null,
        untilAt: input.event.until_at ?? null,
        countN: input.event.count_n ?? null,
        originalStartAt: input.event.original_start_at ?? null,
        isCancelled: Boolean(input.event.is_cancelled),
        timezone: input.event.timezone ?? null,
        isGlobal: Boolean(input.event.is_global),
        raw: {}
      };

      set((state) => {
        const current = state.eventsByCalendar[input.calendarId]?.events ?? [];
        return {
          pendingMutations: state.pendingMutations + 1,
          eventsByCalendar: {
            ...state.eventsByCalendar,
            [input.calendarId]: {
              events: [...current, optimisticEvent],
              fetchedAt: Date.now()
            }
          },
          eventsState: { ...state.eventsState, data: [...current, optimisticEvent] }
        };
      });

      try {
        if (input.event.is_global) {
          await get().service.createGlobalCalendarEvent({
            Bearer: get().token,
            group_id: input.groupId ?? get().groupId,
            group_calendar_id: input.calendarId,
            ...input.event
          });
        } else {
          await get().service.createGroupCalendarEvent({
            Bearer: get().token,
            group_id: input.groupId ?? get().groupId,
            group_calendar_id: input.calendarId,
            ...input.event
          });
        }
        await get().loadEvents(input.calendarId);
      } finally {
        set((state) => ({ pendingMutations: Math.max(0, state.pendingMutations - 1) }));
      }
    },
    updateEvent: async (input) => {
      const current = get().eventsByCalendar[input.calendarId]?.events ?? [];
      const before = [...current];
      const next = current.map((event) => {
        if (event.id !== input.eventId) {
          return event;
        }
        return {
          ...event,
          kind: input.updates.kind ?? event.kind,
          name: input.updates.name ?? event.name,
          parentId: input.updates.parent_id ?? event.parentId,
          location: input.updates.location ?? event.location,
          allDay: input.updates.all_day ?? event.allDay,
          startAt: input.updates.start_at ?? event.startAt,
          endAt: input.updates.end_at ?? event.endAt,
          rrule: input.updates.rrule ?? event.rrule,
          untilAt: input.updates.until_at ?? event.untilAt,
          countN: input.updates.count_n ?? event.countN,
          originalStartAt: input.updates.original_start_at ?? event.originalStartAt,
          isCancelled: input.updates.is_cancelled ?? event.isCancelled,
          timezone: input.updates.timezone ?? event.timezone,
          isGlobal: input.updates.is_global ?? event.isGlobal
        } satisfies GroupCalendarEvent;
      });
      set((state) => ({
        pendingMutations: state.pendingMutations + 1,
        eventsByCalendar: { ...state.eventsByCalendar, [input.calendarId]: { events: next, fetchedAt: Date.now() } },
        eventsState: { ...state.eventsState, data: next }
      }));

      try {
        if (input.isGlobal) {
          await get().service.modifyGlobalCalendarEvent({
            Bearer: get().token,
            group_id: input.groupId ?? get().groupId,
            group_calendar_id: input.calendarId,
            group_calendar_event_id: input.eventId,
            ...input.updates
          });
        } else {
          await get().service.modifyGroupCalendarEvent({
            Bearer: get().token,
            group_id: input.groupId ?? get().groupId,
            group_calendar_id: input.calendarId,
            group_calendar_event_id: input.eventId,
            ...input.updates
          });
        }
        await get().loadEvents(input.calendarId);
      } catch (error) {
        set((state) => ({
          eventsByCalendar: { ...state.eventsByCalendar, [input.calendarId]: { events: before, fetchedAt: Date.now() } },
          eventsState: { ...state.eventsState, data: before, error: error instanceof Error ? error.message : 'Event update failed' }
        }));
        throw error;
      } finally {
        set((state) => ({ pendingMutations: Math.max(0, state.pendingMutations - 1) }));
      }
    },
    deleteEvent: async (input) => {
      const current = get().eventsByCalendar[input.calendarId]?.events ?? [];
      const before = [...current];
      const next = current.filter((event) => event.id !== input.eventId);
      set((state) => ({
        pendingMutations: state.pendingMutations + 1,
        eventsByCalendar: { ...state.eventsByCalendar, [input.calendarId]: { events: next, fetchedAt: Date.now() } },
        eventsState: { ...state.eventsState, data: next }
      }));

      try {
        if (input.isGlobal) {
          await get().service.deleteGlobalCalendarEvent({
            Bearer: get().token,
            group_calendar_event_id: input.eventId
          });
        } else {
          await get().service.deleteGroupCalendarEvent({
            Bearer: get().token,
            group_id: input.groupId ?? get().groupId,
            group_calendar_id: input.calendarId,
            group_calendar_event_id: input.eventId
          });
        }
      } catch (error) {
        set((state) => ({
          eventsByCalendar: { ...state.eventsByCalendar, [input.calendarId]: { events: before, fetchedAt: Date.now() } },
          eventsState: { ...state.eventsState, data: before, error: error instanceof Error ? error.message : 'Event delete failed' }
        }));
        throw error;
      } finally {
        set((state) => ({ pendingMutations: Math.max(0, state.pendingMutations - 1) }));
      }
    },
    getCachedEvents: (calendarId, scope = 'all') => {
      const items = get().eventsByCalendar[calendarId]?.events ?? [];
      if (scope === 'group') return items.filter((event) => !event.isGlobal);
      if (scope === 'global') return items.filter((event) => event.isGlobal);
      return items;
    }
  }));

const CalendarStoreContext = createContext<ReturnType<typeof createCalendarStore> | null>(null);

export interface CalendarProviderProps {
  groupId: string;
  token?: string;
  clientIp?: string;
  children: ReactNode;
}

/** Provides calendar service and global store for calendar views. */
export function CalendarProvider({ groupId, token = '', clientIp = '127.0.0.1', children }: CalendarProviderProps) {
  const store = useMemo(() => {
    const client = new ApiClient({
      getToken: () => token,
      getClientIp: () => clientIp
    });
    const api = new CalendarApi(client);
    const service = new CalendarService(api);
    return createCalendarStore(groupId, token, service);
  }, [clientIp, groupId, token]);

  return <CalendarStoreContext.Provider value={store}>{children}</CalendarStoreContext.Provider>;
}

/** Reads full calendar store context. */
export function useCalendarContext(): CalendarStore {
  const store = useContext(CalendarStoreContext);
  if (!store) {
    throw new Error('useCalendarContext must be used inside CalendarProvider');
  }
  return useStore(store);
}

/** Selective store selector helper to avoid rerenders. */
export function useCalendarSelector<T>(selector: (store: CalendarStore) => T): T {
  const store = useContext(CalendarStoreContext);
  if (!store) {
    throw new Error('useCalendarSelector must be used inside CalendarProvider');
  }
  return useStore(store, selector);
}

export type CalendarStoreType = CalendarStore;
export type CalendarModel = GroupCalendar;
