export type SupportedLanguage = 'en' | 'hu';

type TranslationsMap = {
  [key: string]: string;
};

type I18nDictionary = Record<SupportedLanguage, TranslationsMap>;

const events: I18nDictionary = {
  en: {
    'CREATED': 'Created',
    'STATUS_CHANGED': 'Status changed',
    'SUMMARY_CHANGED': 'Title changed',
    'DESCRIPTION_CHANGED': 'Description changed',
    'ASSIGNEE_CHANGED': 'Assignee changed',
    'PRIORITY_CHANGED': 'Priority changed',
    'DUE_DATE_CHANGED': 'Due date changed',
    'TYPE_CHANGED': 'Task type changed',
    'STORY_POINTS_CHANGED': 'Story points changed',
    'STARTED_AT_CHANGED': 'Start date changed',
    'COMPLETED_AT_CHANGED': 'Completion date changed',
    'ARCHIVE_CHANGED': 'Archive status changed',
    'ARCHIVED': 'Archived',
    'DELETED': 'Deleted',
    'TITLE_CHANGED': 'Title changed',
    'START_AT_CHANGED': 'Start date changed',
  },
  hu: {
    'CREATED': 'Létrehozta',
    'STATUS_CHANGED': 'Státusz módosítva',
    'SUMMARY_CHANGED': 'Cím módosítva',
    'DESCRIPTION_CHANGED': 'Leírás módosítva',
    'ASSIGNEE_CHANGED': 'Felelős módosítva',
    'PRIORITY_CHANGED': 'Prioritás módosítva',
    'DUE_DATE_CHANGED': 'Határidő módosítva',
    'TYPE_CHANGED': 'Típus módosítva',
    'STORY_POINTS_CHANGED': 'Story Points módosítva',
    'STARTED_AT_CHANGED': 'Kezdés módosítva',
    'COMPLETED_AT_CHANGED': 'Befejezés módosítva',
    'ARCHIVE_CHANGED': 'Archiválási állapot módosítva',
    'ARCHIVED': 'Archiválva',
    'DELETED': 'Törölve',
    'TITLE_CHANGED': 'Cím módosítva',
    'START_AT_CHANGED': 'Kezdés módosítva',
  }
};

const statuses: I18nDictionary = {
  en: {
    'TODO': 'To Do',
    'IN_PROGRESS': 'In Progress',
    'IN_REVIEW': 'In Review',
    'DONE': 'Done'
  },
  hu: {
    'TODO': 'Teendő',
    'IN_PROGRESS': 'Folyamatban',
    'IN_REVIEW': 'Felülvizsgálat alatt',
    'DONE': 'Kész'
  }
};

export const translateTaskEvent = (eventType: string, lang: SupportedLanguage = 'hu'): string => {
  // Try to find the translation in the specified language, fallback to english, then the key itself
  const langDict = events[lang] || events['en'];
  return langDict[eventType] || events['en'][eventType] || eventType;
};

export const translateTaskValue = (value: string | null | undefined, lang: SupportedLanguage = 'hu'): string | null | undefined => {
  if (!value) return value;
  
  // Try to translate status enum
  const langDict = statuses[lang] || statuses['en'];
  if (langDict[value]) {
    return langDict[value];
  }
  if (statuses['en'][value]) {
    return statuses['en'][value];
  }

  // Fallback to the original value if it's not a known status
  return value;
};
