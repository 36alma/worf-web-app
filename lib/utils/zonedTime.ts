/**
 * Wall-clock ↔ instant conversion for an arbitrary IANA time zone, so a
 * `<input type="datetime-local">` value can be sent as an ISO 8601 string
 * with an explicit offset (the post API rejects zone-less timestamps).
 */

export const browserTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export const listTimeZones = (): string[] => {
  const fallback = Array.from(new Set([browserTimeZone(), 'UTC', 'Europe/Budapest', 'Europe/London', 'America/New_York']));
  try {
    const supported = (Intl as unknown as {supportedValuesOf?: (key: string) => string[]}).supportedValuesOf?.('timeZone');
    if (!supported?.length) return fallback;
    return Array.from(new Set([browserTimeZone(), 'UTC', ...supported]));
  } catch {
    return fallback;
  }
};

/** Wall-clock parts of `instant` in `timeZone`, as if they were UTC (ms). */
const wallClockMs = (instant: Date, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
};

/** Offset of `timeZone` from UTC at `instant`, in minutes (east positive). */
export const zoneOffsetMinutes = (timeZone: string, instant: Date): number =>
  Math.round((wallClockMs(instant, timeZone) - Math.floor(instant.getTime() / 1000) * 1000) / 60000);

const formatOffset = (minutes: number): string => {
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
};

/** `2026-11-01T09:00` + `Europe/Budapest` → `2026-11-01T09:00:00+01:00`; empty input → ''. */
export const localInputToIso = (value: string, timeZone: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return '';
  const [, y, mo, d, h, mi] = match.map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const firstGuess = zoneOffsetMinutes(timeZone, new Date(wall));
  const offset = zoneOffsetMinutes(timeZone, new Date(wall - firstGuess * 60000));
  return `${match[0]}:00${formatOffset(offset)}`;
};

/** ISO instant → `YYYY-MM-DDTHH:mm` wall clock in `timeZone`; invalid → ''. */
export const isoToLocalInput = (iso: string, timeZone: string): string => {
  if (!iso) return '';
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return '';
  return new Date(wallClockMs(instant, timeZone)).toISOString().slice(0, 16);
};

export const isInFuture = (iso: string): boolean => {
  const at = new Date(iso).getTime();
  return Number.isFinite(at) && at > Date.now();
};
