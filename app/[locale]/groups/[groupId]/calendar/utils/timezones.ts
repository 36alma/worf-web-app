/**
 * All IANA timezones grouped by continent/region with i18n support.
 * Used in the EventFormModal timezone dropdown.
 *
 * Continent labels are provided in both 'hu' and 'en'.
 * City display names use the browser's built-in Intl API when available,
 * otherwise fall back to parsing the IANA identifier.
 */

import type {SupportedLocale} from '../types';

interface TimezoneGroup {
  /** i18n labels keyed by locale */
  labels: Record<SupportedLocale, string>;
  zones: string[];
}

const TIMEZONE_GROUPS_DATA: TimezoneGroup[] = [
  {
    labels: {hu: 'Afrika', en: 'Africa'},
    zones: [
      'Africa/Abidjan', 'Africa/Accra', 'Africa/Addis_Ababa', 'Africa/Algiers',
      'Africa/Cairo', 'Africa/Casablanca', 'Africa/Dar_es_Salaam', 'Africa/Johannesburg',
      'Africa/Khartoum', 'Africa/Lagos', 'Africa/Maputo', 'Africa/Nairobi',
      'Africa/Tripoli', 'Africa/Tunis', 'Africa/Windhoek'
    ]
  },
  {
    labels: {hu: 'Amerika', en: 'America'},
    zones: [
      'America/Anchorage', 'America/Argentina/Buenos_Aires', 'America/Bogota',
      'America/Caracas', 'America/Chicago', 'America/Denver', 'America/Edmonton',
      'America/Guatemala', 'America/Halifax', 'America/Havana', 'America/Lima',
      'America/Los_Angeles', 'America/Manaus', 'America/Mexico_City',
      'America/Montevideo', 'America/New_York', 'America/Panama',
      'America/Phoenix', 'America/Santiago', 'America/Sao_Paulo',
      'America/St_Johns', 'America/Toronto', 'America/Vancouver', 'America/Winnipeg'
    ]
  },
  {
    labels: {hu: 'Antarktisz', en: 'Antarctica'},
    zones: [
      'Antarctica/Casey', 'Antarctica/Davis', 'Antarctica/McMurdo',
      'Antarctica/Palmer', 'Antarctica/Syowa'
    ]
  },
  {
    labels: {hu: 'Ázsia', en: 'Asia'},
    zones: [
      'Asia/Almaty', 'Asia/Amman', 'Asia/Baghdad', 'Asia/Baku', 'Asia/Bangkok',
      'Asia/Beirut', 'Asia/Colombo', 'Asia/Damascus', 'Asia/Dhaka', 'Asia/Dubai',
      'Asia/Ho_Chi_Minh', 'Asia/Hong_Kong', 'Asia/Irkutsk', 'Asia/Istanbul',
      'Asia/Jakarta', 'Asia/Jerusalem', 'Asia/Kabul', 'Asia/Kamchatka',
      'Asia/Karachi', 'Asia/Kathmandu', 'Asia/Kolkata', 'Asia/Krasnoyarsk',
      'Asia/Kuala_Lumpur', 'Asia/Kuwait', 'Asia/Magadan', 'Asia/Manila',
      'Asia/Muscat', 'Asia/Novosibirsk', 'Asia/Riyadh', 'Asia/Seoul',
      'Asia/Shanghai', 'Asia/Singapore', 'Asia/Taipei', 'Asia/Tashkent',
      'Asia/Tbilisi', 'Asia/Tehran', 'Asia/Tokyo', 'Asia/Vladivostok',
      'Asia/Yakutsk', 'Asia/Yekaterinburg'
    ]
  },
  {
    labels: {hu: 'Atlanti-óceán', en: 'Atlantic'},
    zones: [
      'Atlantic/Azores', 'Atlantic/Canary', 'Atlantic/Cape_Verde',
      'Atlantic/Reykjavik', 'Atlantic/South_Georgia'
    ]
  },
  {
    labels: {hu: 'Ausztrália', en: 'Australia'},
    zones: [
      'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Darwin',
      'Australia/Hobart', 'Australia/Melbourne', 'Australia/Perth',
      'Australia/Sydney'
    ]
  },
  {
    labels: {hu: 'Európa', en: 'Europe'},
    zones: [
      'Europe/Amsterdam', 'Europe/Athens', 'Europe/Belgrade', 'Europe/Berlin',
      'Europe/Brussels', 'Europe/Bucharest', 'Europe/Budapest', 'Europe/Copenhagen',
      'Europe/Dublin', 'Europe/Helsinki', 'Europe/Istanbul', 'Europe/Kaliningrad',
      'Europe/Kiev', 'Europe/Lisbon', 'Europe/London', 'Europe/Madrid',
      'Europe/Minsk', 'Europe/Moscow', 'Europe/Oslo', 'Europe/Paris',
      'Europe/Prague', 'Europe/Riga', 'Europe/Rome', 'Europe/Samara',
      'Europe/Sofia', 'Europe/Stockholm', 'Europe/Tallinn', 'Europe/Vienna',
      'Europe/Vilnius', 'Europe/Warsaw', 'Europe/Zurich'
    ]
  },
  {
    labels: {hu: 'Indiai-óceán', en: 'Indian Ocean'},
    zones: [
      'Indian/Maldives', 'Indian/Mauritius', 'Indian/Reunion'
    ]
  },
  {
    labels: {hu: 'Csendes-óceán', en: 'Pacific'},
    zones: [
      'Pacific/Apia', 'Pacific/Auckland', 'Pacific/Chatham', 'Pacific/Easter',
      'Pacific/Fiji', 'Pacific/Guam', 'Pacific/Honolulu', 'Pacific/Midway',
      'Pacific/Noumea', 'Pacific/Pago_Pago', 'Pacific/Port_Moresby',
      'Pacific/Tongatapu'
    ]
  },
  {
    labels: {hu: 'UTC', en: 'UTC'},
    zones: ['UTC']
  }
];

/** Exported type for the consumer */
export interface LocalizedTimezoneGroup {
  label: string;
  zones: string[];
}

/**
 * Returns timezone groups with continent labels localized for the given locale.
 */
export const getTimezoneGroups = (locale: SupportedLocale): LocalizedTimezoneGroup[] =>
  TIMEZONE_GROUPS_DATA.map((group) => ({
    label: group.labels[locale] ?? group.labels.en,
    zones: group.zones
  }));

/**
 * Get a human-readable city display name for a timezone.
 *
 * Uses the Intl API's `timeZoneName: 'long'` to get the localized timezone
 * name (e.g., "Közép-európai nyári idő" in Hungarian).
 * Falls back to parsing the IANA identifier (e.g., "Budapest").
 */
export const getTimezoneDisplayName = (tz: string, locale: SupportedLocale): string => {
  // Extract the city part from the IANA ID (last segment)
  const parts = tz.split('/');
  const city = (parts[parts.length - 1] ?? tz).replace(/_/g, ' ');
  return city;
};

/**
 * Get the localized long timezone name via the Intl API.
 * E.g., for Europe/Budapest in 'hu': "közép-európai nyári idő"
 * Falls back to empty string for unknown timezones.
 */
export const getTimezoneLongName = (tz: string, locale: SupportedLocale): string => {
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      timeZoneName: 'long'
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    return tzPart?.value ?? '';
  } catch {
    return '';
  }
};

/**
 * Get the current UTC offset label for a timezone, e.g., "GMT+2"
 */
export const getTimezoneOffset = (tz: string): string => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset'
    });
    const parts = formatter.formatToParts(new Date());
    const offsetPart = parts.find((p) => p.type === 'timeZoneName');
    return offsetPart?.value ?? '';
  } catch {
    return '';
  }
};
