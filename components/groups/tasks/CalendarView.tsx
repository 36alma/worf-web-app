import {useMemo} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import {Task} from './types';

export interface CalendarViewProps {
  tasks: Task[];
  permissions: unknown;
  onTaskClick: (task: Task) => void;
}

const STATUS_COLORS: Record<string, string> = {
  TODO: '#a1a1aa',
  IN_PROGRESS: '#3b82f6',
  DONE: '#10b981'
};

export default function CalendarView({tasks, onTaskClick}: CalendarViewProps) {
  const t = useTranslations('tasks');
  const locale = useLocale();

  const events = useMemo(() => {
    return tasks
      .filter((task) => task.due_at || task.started_at)
      .map((task) => ({
        id: task.id,
        title: task.summary,
        start: (task.due_at || task.started_at) as string,
        allDay: true,
        backgroundColor: STATUS_COLORS[task.status] || '#f97316',
        borderColor: 'transparent',
        extendedProps: {task}
      }));
  }, [tasks]);

  return (
    <div className="h-[calc(100vh-200px)] w-full flex-1 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm">
      <div className="fc-theme-standard h-full">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          events={events}
          eventClick={(info) => {
            const task = info.event.extendedProps.task as Task | undefined;
            if (task) onTaskClick(task);
          }}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth'
          }}
          height="100%"
          firstDay={1}
          buttonText={{
            today: t('calendar.today'),
            month: t('calendar.month')
          }}
          locale={locale}
        />
      </div>
    </div>
  );
}
