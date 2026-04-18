import {useMemo} from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import {Task} from './types';

export interface CalendarViewProps {
  tasks: Task[];
  permissions: any;
  onTaskClick: (task: Task) => void;
}

const STATUS_COLORS: Record<string, string> = {
  TODO: '#a1a1aa',        // zinc-400
  IN_PROGRESS: '#3b82f6', // blue-500
  DONE: '#10b981'         // emerald-500
};

export default function CalendarView({tasks, permissions, onTaskClick}: CalendarViewProps) {
  
  const events = useMemo(() => {
    return tasks
      .filter(t => t.due_at || t.started_at)
      .map(task => ({
        id: task.task_id,
        title: task.summary,
        start: task.due_at || task.started_at,
        allDay: true,
        backgroundColor: STATUS_COLORS[task.status] || '#6366f1', // indigo-500 fallback
        borderColor: 'transparent',
        extendedProps: {
          task
        }
      }));
  }, [tasks]);

  const handleEventClick = (info: any) => {
    const task = info.event.extendedProps.task;
    if (task) {
      onTaskClick(task);
    }
  };

  return (
    <div className="w-full flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm h-[calc(100vh-200px)] overflow-hidden">
      <div className="h-full fc-theme-standard">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          events={events}
          eventClick={handleEventClick}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth'
          }}
          height="100%"
          firstDay={1} // Monday
          buttonText={{
            today: 'Ma',
            month: 'Hónap'
          }}
          locale="hu"
        />
      </div>
    </div>
  );
}
