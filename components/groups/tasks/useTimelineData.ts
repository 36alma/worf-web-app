import {useMemo} from 'react';
import {Task} from './types';

export interface TimelineTaskItem {
  id: string;
  name: string;
  start: Date;
  end: Date;
  progress: number;
  isDisabled: boolean;
  hasDueAt: boolean;
  task: Task;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function useTimelineData(tasks: Task[], canRead: boolean) {
  const items = useMemo<TimelineTaskItem[]>(() => {
    if (!canRead) return [];

    return tasks.flatMap((task) => {
      const parseDate = (value?: string | null) => {
        if (!value) return null;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      };

      let start = parseDate(task.started_at);
      const hasDueAt = Boolean(task.due_at);
      let end = parseDate(task.due_at);

      if (!start && task.created_at) {
        start = parseDate(task.created_at);
      }

      if (!start && end) {
        start = new Date(end.getTime() - DAY_MS);
      }

      if (!start) {
        return [];
      }

      if (!end) {
        end = new Date(start.getTime() + DAY_MS);
      }

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return [];
      }

      if (start.getTime() > end.getTime()) {
        end = new Date(start.getTime() + DAY_MS);
      }

      let progress = 0;
      if (task.status === 'DONE') progress = 100;
      else if (task.status === 'IN_PROGRESS') progress = 50;
      else if (task.status === 'IN_REVIEW') progress = 80;

      return [{
        id: task.id,
        name: task.summary || 'Nevtelen feladat',
        start,
        end,
        progress,
        isDisabled: !canRead,
        hasDueAt,
        task
      }];
    });
  }, [tasks, canRead]);

  return {
    items,
    loading: false
  };
}
