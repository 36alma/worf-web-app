'use client';

import {useMemo, useState, useEffect} from 'react';
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

  // Mobilon napi nézet, desktopom havi nézet – SSR-safe (useState default = desktop)
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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
    <div className="h-[calc(100svh-220px)] w-full flex-1 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 shadow-sm md:h-[calc(100vh-200px)] md:p-4">
      <div className="fc-theme-standard h-full">
        {/* key={isMobile} force remount when switching views to avoid FullCalendar stale state */}
        <FullCalendar
          key={isMobile ? 'mobile' : 'desktop'}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView={isMobile ? 'dayGridDay' : 'dayGridMonth'}
          events={events}
          eventClick={(info) => {
            const task = info.event.extendedProps.task as Task | undefined;
            if (task) onTaskClick(task);
          }}
          headerToolbar={
            isMobile
              ? {
                  left: 'prev,next',
                  center: 'title',
                  right: 'today'
                }
              : {
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth'
                }
          }
          height="100%"
          firstDay={1}
          buttonText={{
            today: t('calendar.today'),
            month: t('calendar.month'),
            day: t('calendar.today')
          }}
          locale={locale}
          // Touch-friendly event height
          eventMinHeight={isMobile ? 44 : 24}
        />
      </div>
    </div>
  );
}
