/** Date and event helpers for calendar rendering and validation. */
import type { GroupCalendarEvent } from '@/src/types/calendar.types';

export function parseISODate(isoString: string): Date {
  return new Date(isoString);
}

export function formatDate(date: Date | string): string {
  const parsed = typeof date === 'string' ? parseISODate(date) : date;
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return parsed.toLocaleString();
}

export function isEventToday(event: GroupCalendarEvent): boolean {
  if (!event.startAt) {
    return false;
  }
  const d = parseISODate(event.startAt);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export function isEventUpcoming(event: GroupCalendarEvent): boolean {
  if (!event.startAt) {
    return false;
  }
  return parseISODate(event.startAt).getTime() > Date.now();
}

export function groupEventsByDate(events: GroupCalendarEvent[]): Map<string, GroupCalendarEvent[]> {
  const map = new Map<string, GroupCalendarEvent[]>();
  for (const event of events) {
    if (!event.startAt) {
      continue;
    }
    const key = event.startAt.slice(0, 10);
    const current = map.get(key) ?? [];
    current.push(event);
    map.set(key, current);
  }
  return map;
}

export function validateEventDates(startAt?: string | null, endAt?: string | null): boolean {
  if (!startAt || !endAt) {
    return true;
  }
  const start = parseISODate(startAt);
  const end = parseISODate(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }
  return start.getTime() <= end.getTime();
}
