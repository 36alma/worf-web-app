import React from 'react';
import { Gantt, Task as GanttTask, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import { useTimelineData } from './useTimelineData';
import { Task } from './types';

interface TimelineViewProps {
  groupId: string;
  permissions: {
    task: { read: boolean; modify: boolean };
  };
  onTaskClick: (task: Task) => void;
  tasks: Task[]; // Unused local tasks, we use useTimelineData as requested
}

export default function TimelineView({ groupId, permissions, onTaskClick }: TimelineViewProps) {
  const { items, loading, rawTasks } = useTimelineData(groupId, permissions.task.read);

  if (!permissions.task.read) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--bg-primary)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-default)] border-t-indigo-600" />
      </div>
    );
  }

  const handleTaskClick = (task: GanttTask) => {
    // If it's a dummy task from empty state
    if (task.id === '1' && task.name === 'Nincs feladat') return;

    // Find original task to open sheet
    const originalTask = rawTasks.find(t => (t.task_id || t.id) === task.id);
    if (originalTask) {
      onTaskClick(originalTask);
    }
  };

  const handleDateChange = (task: GanttTask, children: GanttTask[]) => {
      return; 
  };

  const finalItems = items.map(item => ({
       ...item,
       isDisabled: !permissions.task.modify
  }));

  return (
    <div className="worf-dark-gantt-wrapper w-full h-[calc(100vh-250px)] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl relative">
      <Gantt
        tasks={finalItems}
        viewMode={ViewMode.Day}
        onClick={handleTaskClick}
        onDateChange={handleDateChange}
        onProgressChange={() => {}} // dummy
        onDelete={() => {}} // dummy
        listCellWidth="250px"
        rowHeight={50}
        ganttHeight={0}
        barCornerRadius={4}
        todayColor="rgba(249, 115, 22, 0.2)"
        fontFamily="var(--font-sans, system-ui, sans-serif)"
        fontSize="13px"
      />
      
      {/* Globális felülírás a WORF Sötét témához a Gantt charton belül */}
      <style dangerouslySetInnerHTML={{__html: `
        .worf-dark-gantt-wrapper {
          /* Alap hátterek */
          --gantt-bg: #18181b; /* zinc-900 */
          --gantt-header-bg: #09090b; /* zinc-950 */
          --gantt-border: #27272a; /* zinc-800 */
          --gantt-text: #e4e4e7; /* zinc-200 */
          --gantt-text-muted: #a1a1aa; /* zinc-400 */
        }

        .worf-dark-gantt-wrapper * {
          border-color: var(--gantt-border) !important;
        }

        /* SVG Rendering fix to avoid blurry lines */
        .worf-dark-gantt-wrapper svg {
           shape-rendering: crispEdges;
        }
        .worf-dark-gantt-wrapper text, .worf-dark-gantt-wrapper path {
           shape-rendering: geometricPrecision;
        }

        /* Bal oldali lista (Task List) kényszerítése sötétre */
        .worf-dark-gantt-wrapper div[style*="background-color: #fff"],
        .worf-dark-gantt-wrapper div[style*="background-color: rgb(255, 255, 255)"],
        .worf-dark-gantt-wrapper div[style*="background-color: #ffffff"],
        .worf-dark-gantt-wrapper div[style*="background-color: white"] {
          background-color: var(--gantt-bg) !important;
          color: var(--gantt-text) !important;
        }

        /* Minden páros/páratlan sor (alternating rows) sötétítése */
        .worf-dark-gantt-wrapper ._3_123, 
        .worf-dark-gantt-wrapper > div > div > div > div {
          background-color: var(--gantt-bg) !important;
          color: var(--gantt-text) !important;
        }
        
        .worf-dark-gantt-wrapper div:hover {
           /* Ensure we don't accidentally hover the whole table to white, let's inject a strict hover class */
        }

        /* The actual list rows container hover fix */
        .worf-dark-gantt-wrapper > div > div > div > div:hover {
          background-color: var(--gantt-border) !important;
        }

        /* SVG Naptár rács (Jobb oldal) sötétítése */
        .worf-dark-gantt-wrapper svg {
          background-color: var(--gantt-bg) !important;
        }

        /* Rácsvonalak az SVG-ben */
        .worf-dark-gantt-wrapper svg line,
        .worf-dark-gantt-wrapper svg path {
          stroke: var(--gantt-border) !important;
        }

        /* Szövegek az SVG-ben (Dátumok, Hónapok) */
        .worf-dark-gantt-wrapper svg text {
          fill: var(--gantt-text) !important;
        }

        /* A feladatok sávjai (Bar) melletti szöveg */
        .worf-dark-gantt-wrapper .barLabel {
          fill: var(--gantt-text) !important;
        }

        /* Fejlécek (Headers) sötétítése */
        .worf-dark-gantt-wrapper > div > div:first-child,
        .worf-dark-gantt-wrapper > div > div > div:first-child {
          background-color: var(--gantt-header-bg) !important;
        }

        /* Revert Task List text color explicitly just in case */
        .worf-dark-gantt-wrapper span, .worf-dark-gantt-wrapper p {
          color: var(--gantt-text) !important;
        }
      `}} />
    </div>
  );
}
