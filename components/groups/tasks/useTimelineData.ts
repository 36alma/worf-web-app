import { useState, useEffect } from 'react';
import { getTaskPanel } from '@/lib/api/tasks';
import { Task as GanttTask } from 'gantt-task-react';
import { Task } from './types';

export function useTimelineData(groupId: string, canRead: boolean) {
  const [items, setItems] = useState<GanttTask[]>([]);
  const [rawTasks, setRawTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }

    const fetchTasks = async () => {
      setLoading(true);
      try {
        const res = await getTaskPanel({
          group_id: groupId,
          page_number: 1,
          load_task_number: 100,
        });

        const data = res.data?.data || res.data || {};
        let tasks = [];
        if (Array.isArray(data.tasks)) {
          tasks = data.tasks;
        } else if (Array.isArray(data)) {
          tasks = data;
        }

        setRawTasks(tasks);

        const timelineItems: GanttTask[] = [];
        tasks.forEach((t: any) => {
          const id = t.task_id || t.id;
          const name = t.summary || 'Névtelen feladat';
          
          let startObj: Date;
          let endObj: Date;

          if (t.started_at) {
            startObj = new Date(t.started_at);
          } else if (t.due_at) {
             const dt = new Date(t.due_at);
             dt.setDate(dt.getDate() - 1);
             startObj = dt;
          } else if (t.created_at) {
             startObj = new Date(t.created_at);
          } else {
             startObj = new Date(); // fallback Today
          }

          if (t.due_at) {
            endObj = new Date(t.due_at);
          } else {
             // If no due date, we give it a 1-day duration as a milestone or short bar
             const nextDay = new Date(startObj);
             nextDay.setDate(nextDay.getDate() + 1);
             endObj = nextDay;
          }

          // Ensure start is before end
          if (startObj.getTime() > endObj.getTime()) {
             startObj = new Date(endObj.getTime() - 86400000); // 1 day before
          }

          let progress = 0;
          if (t.status === 'DONE') progress = 100;
          if (t.status === 'IN_PROGRESS') progress = 50;

          // Default styling: Force WORF orange (#f97316) as requested
          const barColor = '#f97316';

          timelineItems.push({
            start: startObj,
            end: endObj,
            name: name,
            id: id,
            type: "task",
            progress: progress,
            isDisabled: false, // Managed by component level
            styles: { 
               progressColor: '#ea580c', // Darker orange for progress
               progressSelectedColor: '#c2410c', 
               backgroundColor: barColor, 
               backgroundSelectedColor: '#ea580c' 
            }
          });
        });

        if (timelineItems.length === 0) {
           // Provide a dummy if empty to not crash
           const today = new Date();
           const tmrw = new Date();
           tmrw.setDate(today.getDate() + 1);
           timelineItems.push({
             start: today, end: tmrw, name: 'Nincs feladat', id: '1', type: 'task', progress: 0, isDisabled: true
           });
        }

        setItems(timelineItems);
      } catch (error) {
        console.error('Failed to fetch timeline data', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [groupId, canRead]);

  return { items, loading, rawTasks };
}
