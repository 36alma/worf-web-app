import {formatEventTime, getDateLocale} from './calendarHelpers';

export type DayBucket = 'today' | 'tomorrow' | 'other';

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Which local calendar day `target` falls on, relative to `now` (23/25-hour DST days included). */
export function dayBucket(target: Date, now: Date): DayBucket {
  const diff = Math.round((startOfDay(target) - startOfDay(now)) / 86_400_000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return 'other';
}

export type ElapsedUnit = 'second' | 'minute' | 'hour' | 'day';

/** How long ago `target` was, in the coarsest whole unit — `null` past a week, when a date reads better than "9 days ago". */
export function describeElapsed(target: Date, now: Date): {value: number; unit: ElapsedUnit} | null {
  // A clock a little ahead of the server must not produce "in 3 seconds".
  const seconds = Math.max(0, Math.floor((now.getTime() - target.getTime()) / 1000));
  if (Number.isNaN(seconds)) return null;
  if (seconds < 60) return {value: seconds, unit: 'second'};
  if (seconds < 3600) return {value: Math.floor(seconds / 60), unit: 'minute'};
  if (seconds < 86_400) return {value: Math.floor(seconds / 3600), unit: 'hour'};
  if (seconds < 7 * 86_400) return {value: Math.floor(seconds / 86_400), unit: 'day'};
  return null;
}

export interface DayLabel {
  bucket: DayBucket;
  /** Local time of day, e.g. `14:00`. */
  time: string;
  /** Short weekday + date, e.g. `k, szept. 22.` — for the `other` bucket. */
  day: string;
}

/** Pieces for "today 14:00" / "tomorrow 14:00" / "Tue, Sep 22, 2:00 PM"; the caller supplies the translated words. */
export function describeDay(iso: string, now: Date, locale: string): DayLabel | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return {
    bucket: dayBucket(date, now),
    time: formatEventTime(date, locale),
    day: new Intl.DateTimeFormat(getDateLocale(locale), {weekday: 'short', month: 'short', day: 'numeric'}).format(date)
  };
}
