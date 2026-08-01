'use client';

import {CalendarRange, Clock} from 'lucide-react';
import {useEffect, useMemo, useState} from 'react';
import clsx from 'clsx';
import {useTimelineData} from './useTimelineData';
import {
  Task,
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
  PRIORITY_LABELS
} from './types';

interface TimelineViewProps {
  groupId: string;
  permissions: {
    task: { read: boolean; modify: boolean };
  };
  onTaskClick: (task: Task) => void;
  onTaskScheduleChange: (taskId: string, changes: {started_at: string; due_at: string | null}) => Promise<void>;
  tasks: Task[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_WIDTH = 76;
const SIDEBAR_WIDTH = 320;
const ROW_HEIGHT = 72;

const STATUS_BAR_COLORS: Record<string, string> = {
  TODO: 'bg-sky-500/80',
  IN_PROGRESS: 'bg-blue-500/80',
  IN_REVIEW: 'bg-emerald-500/80',
  DONE: 'bg-emerald-500/80',
  BLOCKED: 'bg-red-500/80'
};

const PRIORITY_BAR_COLORS: Record<string, string> = {
  URGENT: 'bg-red-500/80',
  HIGH: 'bg-amber-500/80',
  MEDIUM: 'bg-amber-500/80',
  NORMAL: 'bg-amber-500/80',
  LOW: 'bg-emerald-500/80'
};

function toStartOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function toEndOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function diffDays(start: Date, end: Date) {
  return Math.floor((toStartOfDay(end).getTime() - toStartOfDay(start).getTime()) / DAY_MS);
}

function startOfWeek(date: Date) {
  const value = toStartOfDay(date);
  const day = value.getDay();
  const shift = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + shift);
  return value;
}

function formatRangeDate(date: Date) {
  return new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat('hu-HU', {
    month: 'short',
    day: 'numeric'
  }).format(date);
}

function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat('hu-HU', {
    weekday: 'short'
  }).format(date);
}

function buildWeekSegments(days: Date[]) {
  const segments: Array<{label: string; span: number; key: string}> = [];

  days.forEach((day) => {
    const monday = startOfWeek(day);
    const key = monday.toISOString();
    const label = `${formatDayLabel(monday)} het`;
    const last = segments[segments.length - 1];

    if (last && last.key === key) {
      last.span += 1;
      return;
    }

    segments.push({label, span: 1, key});
  });

  return segments;
}

function getBarTone(task: Task) {
  return PRIORITY_BAR_COLORS[task.priority ? task.priority.toUpperCase() : '']
    || STATUS_BAR_COLORS[task.status]
    || 'bg-sky-500/80';
}

type DragMode = 'move' | 'resize-start' | 'resize-end';

interface DragState {
  taskId: string;
  mode: DragMode;
  pointerStartX: number;
  originalStart: Date;
  originalEnd: Date;
  originalHasDueAt: boolean;
}

interface DraftSchedule {
  start: Date;
  end: Date;
  hasDueAt: boolean;
}

function toIsoAtNoon(date: Date) {
  const value = new Date(date);
  value.setHours(12, 0, 0, 0);
  return value.toISOString();
}

export default function TimelineView({
  groupId: _groupId,
  permissions,
  onTaskClick,
  onTaskScheduleChange,
  tasks
}: TimelineViewProps) {
  const {items} = useTimelineData(tasks, permissions.task.read);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftSchedule>>({});
  const [dragMoved, setDragMoved] = useState(false);
  const [suppressClickTaskId, setSuppressClickTaskId] = useState<string | null>(null);
  const displayItems = useMemo(() => items.map((item) => {
    const draft = drafts[item.id];
    if (!draft) {
      return item;
    }

    return {
      ...item,
      start: draft.start,
      end: draft.end,
      hasDueAt: draft.hasDueAt
    };
  }), [drafts, items]);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const deltaDays = Math.round((event.clientX - dragState.pointerStartX) / DAY_WIDTH);
      setDragMoved(deltaDays !== 0);

      let nextStart = dragState.originalStart;
      let nextEnd = dragState.originalEnd;
      let hasDueAt = dragState.originalHasDueAt;

      if (dragState.mode === 'move') {
        nextStart = addDays(dragState.originalStart, deltaDays);
        nextEnd = addDays(dragState.originalEnd, deltaDays);
      }

      if (dragState.mode === 'resize-start') {
        const candidate = addDays(dragState.originalStart, deltaDays);
        nextStart = candidate > dragState.originalEnd ? dragState.originalEnd : candidate;
      }

      if (dragState.mode === 'resize-end') {
        hasDueAt = true;
        const minEnd = dragState.originalStart;
        const candidate = addDays(dragState.originalEnd, deltaDays);
        nextEnd = candidate < minEnd ? minEnd : candidate;
      }

      setDrafts((current) => ({
        ...current,
        [dragState.taskId]: {
          start: toStartOfDay(nextStart),
          end: toStartOfDay(nextEnd),
          hasDueAt
        }
      }));
    };

    const handlePointerUp = async () => {
      const draft = drafts[dragState.taskId];
      const shouldCommit = draft && dragMoved && (
        draft.start.getTime() !== toStartOfDay(dragState.originalStart).getTime()
        || draft.end.getTime() !== toStartOfDay(dragState.originalEnd).getTime()
        || draft.hasDueAt !== dragState.originalHasDueAt
      );

      setDragState(null);
      if (dragMoved) {
        setSuppressClickTaskId(dragState.taskId);
      }

      if (!shouldCommit || !draft) {
        setDrafts((current) => {
          const next = {...current};
          delete next[dragState.taskId];
          return next;
        });
        setDragMoved(false);
        return;
      }

      const previousDraft = draft;
      setDragMoved(false);

      try {
        await onTaskScheduleChange(dragState.taskId, {
          started_at: toIsoAtNoon(previousDraft.start),
          due_at: previousDraft.hasDueAt ? toIsoAtNoon(previousDraft.end) : null
        });
      } finally {
        setDrafts((current) => {
          const next = {...current};
          delete next[dragState.taskId];
          return next;
        });
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragMoved, dragState, drafts, onTaskScheduleChange]);

  if (!permissions.task.read) {
    return null;
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full w-full min-w-0 flex-1 items-center justify-center rounded-lg border border-border bg-surface-2">
        <div className="flex flex-col items-center gap-3 text-center text-[var(--text-tertiary)]">
          <CalendarRange size={42} className="opacity-60" />
          <div>
            <p className="font-medium text-[var(--text-secondary)]">Nincs feladat ebben az időszakban</p>
            <p className="text-sm">A timeline a betöltött és érvényes dátummal rendelkező feladatokból épül fel.</p>
          </div>
        </div>
      </div>
    );
  }

  const rawStart = items.reduce((min, item) => item.start < min ? item.start : min, items[0].start);
  const rawEnd = items.reduce((max, item) => item.end > max ? item.end : max, items[0].end);
  const start = addDays(toStartOfDay(rawStart), -1);
  const end = addDays(toEndOfDay(rawEnd), 2);
  const totalDays = Math.max(1, diffDays(start, end) + 1);
  const totalMs = Math.max(DAY_MS, end.getTime() - start.getTime());
  const days = Array.from({length: totalDays}, (_, index) => addDays(start, index));
  const weekSegments = buildWeekSegments(days);
  const today = toStartOfDay(new Date()).getTime();
  const timelineWidth = totalDays * DAY_WIDTH;
  const activeDragTaskId = dragState?.taskId ?? null;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface-1">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
        <div>
          <h2 className="text-lg font-medium text-[var(--text-primary)]">Idovonal</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {formatRangeDate(start)} - {formatRangeDate(end)}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
          <Clock size={15} />
          <span>{items.length} feladat</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto scrollbar-thin">
        <div
          className="min-h-full"
          style={{minWidth: SIDEBAR_WIDTH + timelineWidth}}
        >
          <div className="sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur">
            <div className="flex">
              <div
                className="sticky left-0 z-30 shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur"
                style={{width: SIDEBAR_WIDTH}}
              >
                <div className="flex h-10 items-center px-4 text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                  Feladatok
                </div>
                <div className="flex h-12 items-center px-4 text-xs text-[var(--text-tertiary)]">
                  Summary, status, priority
                </div>
              </div>

              <div className="shrink-0" style={{width: timelineWidth}}>
                <div
                  className="grid h-10 border-b border-[var(--border-subtle)]"
                  style={{gridTemplateColumns: `repeat(${totalDays}, minmax(${DAY_WIDTH}px, 1fr))`}}
                >
                  {weekSegments.map((segment) => (
                    <div
                      key={segment.key}
                      className="flex items-center border-r border-[var(--border-subtle)] px-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-tertiary)] last:border-r-0"
                      style={{gridColumn: `span ${segment.span} / span ${segment.span}`}}
                    >
                      {segment.label}
                    </div>
                  ))}
                </div>

                <div
                  className="grid h-12"
                  style={{gridTemplateColumns: `repeat(${totalDays}, minmax(${DAY_WIDTH}px, 1fr))`}}
                >
                  {days.map((day) => {
                    const isToday = toStartOfDay(day).getTime() === today;
                    return (
                      <div
                        key={day.toISOString()}
                        className={clsx(
                          'flex flex-col justify-center border-r border-[var(--border-subtle)] px-2 text-center last:border-r-0',
                          isToday && 'bg-accent/10'
                        )}
                      >
                        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                          {formatWeekday(day)}
                        </span>
                        <span className={clsx('text-sm font-medium', isToday ? 'text-accent' : 'text-[var(--text-primary)]')}>
                          {formatDayLabel(day)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            {displayItems.map((item) => {
               const normalizedStart = new Date(item.start);
               const normalizedEnd = new Date(item.end);
               if (Number.isNaN(normalizedStart.getTime()) || Number.isNaN(normalizedEnd.getTime())) {
                 return null;
               }

               const startMs = Math.max(start.getTime(), normalizedStart.getTime());
               const inclusiveEnd = Math.min(end.getTime(), toEndOfDay(normalizedEnd).getTime());
               const leftPct = ((startMs - start.getTime()) / totalMs) * 100;
               const widthPct = Math.max(((inclusiveEnd - startMs) / totalMs) * 100, (DAY_MS / totalMs) * 100);
               const barTone = getBarTone(item.task);
               const issueKey = item.task.issue_key || item.name;
               const priorityLabel = item.task.priority ? (PRIORITY_LABELS[item.task.priority] || item.task.priority) : null;
               const statusLabel = STATUS_LABELS[item.task.status as keyof typeof STATUS_LABELS] || item.task.status;

              const isDragging = activeDragTaskId === item.id;

              const beginDrag = (mode: DragMode, event: React.PointerEvent<HTMLButtonElement | HTMLSpanElement>) => {
                if (!permissions.task.modify) {
                  return;
                }

                event.preventDefault();
                event.stopPropagation();

                setDragMoved(false);
                setDragState({
                  taskId: item.id,
                  mode,
                  pointerStartX: event.clientX,
                  originalStart: item.start,
                  originalEnd: item.end,
                  originalHasDueAt: item.hasDueAt
                });

                setDrafts((current) => ({
                  ...current,
                  [item.id]: {
                    start: toStartOfDay(item.start),
                    end: toStartOfDay(item.end),
                    hasDueAt: item.hasDueAt
                  }
                }));
              };

              return (
                <div
                  key={item.id}
                  className="flex border-b border-[var(--border-subtle)] last:border-b-0"
                  style={{height: ROW_HEIGHT}}
                >
                  <button
                    type="button"
                    onClick={() => onTaskClick(item.task)}
                    className="sticky left-0 z-10 flex shrink-0 items-center border-r border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 px-4 text-left backdrop-blur transition-colors hover:bg-[var(--bg-hover)]"
                    style={{width: SIDEBAR_WIDTH, height: ROW_HEIGHT}}
                  >
                    <div className="min-w-0 space-y-2">
                      <div className="truncate text-sm font-medium text-[var(--text-primary)]">
                        {item.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={clsx('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium', STATUS_COLORS[item.task.status as keyof typeof STATUS_COLORS] || 'border-border bg-surface-2 text-fg-secondary')}>
                          {statusLabel}
                        </span>
                        {priorityLabel ? (
                          <span className={clsx('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[item.task.priority] || 'border-border bg-surface-2 text-fg-secondary')}>
                            {priorityLabel}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>

                  <div
                    className="relative shrink-0"
                    style={{width: timelineWidth, height: ROW_HEIGHT}}
                  >
                    <div
                      className="absolute inset-0 grid"
                      style={{gridTemplateColumns: `repeat(${totalDays}, minmax(${DAY_WIDTH}px, 1fr))`}}
                    >
                      {days.map((day) => {
                        const isToday = toStartOfDay(day).getTime() === today;
                        return (
                          <div
                            key={`${item.id}-${day.toISOString()}`}
                            className={clsx(
                              'border-r border-[var(--border-subtle)] last:border-r-0',
                              isToday && 'bg-accent/5'
                            )}
                          />
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      disabled={item.isDisabled}
                      onClick={() => {
                        if (suppressClickTaskId === item.id) {
                          setSuppressClickTaskId(null);
                          return;
                        }

                        onTaskClick(item.task);
                      }}
                      onPointerDown={(event) => beginDrag('move', event)}
                      className={clsx(
                         'absolute top-1/2 z-10 flex h-9 min-w-[60px] -translate-y-1/2 items-center overflow-hidden rounded-full border border-white/10 px-3 text-left transition-all',
                        barTone,
                        permissions.task.modify && 'cursor-grab active:cursor-grabbing',
                        !item.isDisabled && !isDragging && 'hover:-translate-y-[52%] hover:brightness-110',
                        isDragging && 'z-20 brightness-110 ring-2 ring-accent'
                      )}
                      style={{
                        left: `calc(${leftPct}% + 6px)`,
                        width: `max(calc(${widthPct}% - 12px), 60px)`
                      }}
                      title={`${item.name} (${issueKey})`}
                    >
                      <span
                        className="absolute inset-y-0 left-0 bg-black/15"
                        style={{width: `${item.progress}%`}}
                      />
                      {permissions.task.modify ? (
                        <span
                          role="presentation"
                          onPointerDown={(event) => beginDrag('resize-start', event)}
                          className="absolute left-1 top-1/2 h-6 w-2 -translate-y-1/2 rounded-full bg-white/60 shadow-sm"
                        />
                      ) : null}
                      {permissions.task.modify ? (
                        <span
                          role="presentation"
                          onPointerDown={(event) => beginDrag('resize-end', event)}
                          className="absolute right-1 top-1/2 h-6 w-2 -translate-y-1/2 rounded-full bg-white/60 shadow-sm"
                        />
                      ) : null}
                      <span className="relative flex min-w-0 items-center gap-2">
                        {!item.hasDueAt ? (
                          <span className="h-2.5 w-2.5 rounded-full bg-white/85 shadow-sm" />
                        ) : null}
                        <span className="truncate text-xs font-medium text-white/95">
                          {issueKey}
                        </span>
                      </span>
                    </button>

                    {isDragging ? (
                      <>
                        <div
                          className="absolute top-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-secondary)] backdrop-blur"
                           style={{left: `max(0px, calc(${leftPct}%))`}}
                         >
                           Elkezdve {formatDayLabel(item.start)}
                         </div>
                        <div
                          className="absolute top-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-secondary)] backdrop-blur"
                           style={{left: `max(0px, calc(${leftPct + widthPct}% - 110px))`}}
                         >
                           Határidő {formatDayLabel(item.end)}
                         </div>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
