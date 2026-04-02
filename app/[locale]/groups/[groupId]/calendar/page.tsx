import CalendarView from '@/components/calendar/CalendarView';
import {getTranslations} from 'next-intl/server';

interface GroupCalendarPageProps {
  params: Promise<{
    groupId: string;
  }>;
}

export default async function GroupCalendarPage({params}: GroupCalendarPageProps) {
  const {groupId} = await params;
  const t = await getTranslations('groups');

  return (
    <section className="space-y-4">
      <h1 className="display-font text-2xl">{t('group_calendar')}</h1>
      <CalendarView initialGroupId={groupId} />
    </section>
  );
}
