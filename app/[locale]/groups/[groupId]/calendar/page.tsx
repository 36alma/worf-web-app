/**
 * Calendar page — Server Component wrapper.
 *
 * Decodes the groupId from the URL and passes it to CalendarClient.
 * The CalendarClient handles its own permission checks via useCalendarPermissions
 * and renders FullCalendar or an empty state based on group.calendar.read.
 *
 * Silent Policy: If the groupId is invalid, returns null (blank screen).
 */

import CalendarClient from './CalendarClient';

interface GroupCalendarPageProps {
  params: Promise<{
    locale: string;
    groupId: string;
  }>;
}

export default async function GroupCalendarPage({params}: GroupCalendarPageProps) {
  const {locale, groupId: rawGroupId} = await params;

  // Safely decode — the layout also does this, but we do it here too
  // because CalendarClient needs the clean value as a prop.
  let cleanGroupId: string;
  try {
    cleanGroupId = decodeURIComponent(rawGroupId).trim();
  } catch {
    cleanGroupId = rawGroupId.trim();
  }

  // Silent Policy: invalid ID → blank screen
  if (!cleanGroupId) {
    return null;
  }

  return <CalendarClient groupId={cleanGroupId} locale={locale} />;
}
