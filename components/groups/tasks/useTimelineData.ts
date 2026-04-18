import {useMemo} from 'react';
import {Task} from './types';

export interface TimelineTaskItem {
  id: string;
  name: string;
  start: Date;
  end: Date;
  progress: number;
  isDisabled: boolean;
  task: Task;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function useTimelineData(tasks: Task[], canRead: boolean) {
  const items = useMemo<TimelineTaskItem[]>(() => {
    if (!canRead) return [];

    return tasks.map((task) => {
      let start = task.started_at ? new Date(task.started_at) : null;
      let end = task.due_at ? new Date(task.due_at) : null;

      if (!start && task.created_at) {
        start = new Date(task.created_at);
      }

      if (!end && task.completed_at) {
        end = new Date(task.completed_at);
      }

      if (!start && end) {
        start = new Date(end.getTime() - DAY_MS);
      }

      if (!start) {
        start = new Date();
      }

      if (!end) {
        end = new Date(start.getTime() + DAY_MS);
      }

      if (start.getTime() > end.getTime()) {
        start = new Date(end.getTime() - DAY_MS);
      }

      let progress = 0;
      if (task.status === 'DONE') progress = 100;
      else if (task.status === 'IN_PROGRESS') progress = 50;
      else if (task.status === 'IN_REVIEW') progress = 80;

      return {
        id: task.id,
        name: task.summary || 'Nevtelen feladat',
        start,
        end,
        progress,
        isDisabled: !canRead,
        task
      };
    });
  }, [tasks, canRead]);

  return {
    items,
    loading: false
  };
}
