export type CalendarViewMode = 'month' | 'week' | 'day';

const localeTags: Record<string, string> = {
  hu: 'hu-HU',
  en: 'en-US'
};

const baseLanguage = (language: string) => language.toLowerCase().split('-')[0];

export function getDateLocale(language: string): string {
  return localeTags[baseLanguage(language)] ?? 'en-US';
}

const getWeekRange = (date: Date) => {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(copy);
  start.setDate(copy.getDate() + diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

export function formatCalendarTitle(
  date: Date,
  view: CalendarViewMode,
  language: string
): string {
  const locale = getDateLocale(language);
  const isHungarian = baseLanguage(language) === 'hu';

  if (view === 'month') {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long'
    }).format(date);
  }

  if (view === 'week') {
    const { start, end } = getWeekRange(date);
    if (isHungarian) {
      const startFmt = new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(start);
      const endFmt = new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric'
      }).format(end);
      return `${startFmt} - ${endFmt}`;
    }

    const startFmt = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric'
    }).format(start);
    const endFmt = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(end);
    return `${startFmt} - ${endFmt}`;
  }

  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

export function formatEventTime(date: Date, language: string): string {
  return new Intl.DateTimeFormat(getDateLocale(language), {
    hour: 'numeric',
    minute: '2-digit',
    hour12: baseLanguage(language) !== 'hu'
  }).format(date);
}

export function formatShortDate(date: Date, language: string): string {
  const isHungarian = baseLanguage(language) === 'hu';
  const parts = new Intl.DateTimeFormat(getDateLocale(language), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  const year = parts.find((part) => part.type === 'year')?.value ?? '';

  return isHungarian ? `${year}. ${month}. ${day}.` : `${month}/${day}/${year}`;
}
