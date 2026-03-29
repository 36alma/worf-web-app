'use client';

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import {useLocale, useTranslations} from 'next-intl';

export default function CalendarView() {
  const t = useTranslations('calendar');
  const locale = useLocale();

  return (
    <div className="surface rounded-xl p-4">
      <FullCalendar
        locale={locale}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        height="auto"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
        buttonText={{
          today: t('today'),
          month: t('month'),
          week: t('week'),
          day: t('day')
        }}
        events={[]}
      />
    </div>
  );
}
