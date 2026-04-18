import {CalendarRange, Clock} from 'lucide-react';
import clsx from 'clsx';
import {useTimelineData} from './useTimelineData';
import {Task, STATUS_LABELS} from './types';

interface TimelineViewProps {
  groupId: string;
  permissions: {
    task: { read: boolean; modify: boolean };
  };
  onTaskClick: (task: Task) => void;
  tasks: Task[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_BAR_COLORS: Record<string, string> = {
  TODO: 'from-zinc-500 to-zinc-400',
  IN_PROGRESS: 'from-blue-600 to-indigo-500',
  IN_REVIEW: 'from-violet-600 to-fuchsia-500',
  DONE: 'from-emerald-600 to-emerald-500',
  BLOCKED: 'from-red-600 to-orange-500'
};

function toStartOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function getDayOffset(start: Date, current: Date) {
  return Math.floor((toStartOfDay(current).getTime() - toStartOfDay(start).getTime()) / DAY_MS);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat('hu-HU', {
    month: 'short',
    day: 'numeric'
  }).format(date);
}

export default function TimelineView({groupId: _groupId, permissions, onTaskClick, tasks}: TimelineViewProps) {
  const {items} = useTimelineData(tasks, permissions.task.read);

  if (!permissions.task.read) {
    return null;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
        <div className="flex flex-col items-center gap-3 text-center text-[var(--text-tertiary)]">
          <CalendarRange size={42} className="opacity-60" />
          <div>
            <p className="font-semibold text-[var(--text-secondary)]">Nincs megjelenitheto feladat</p>
            <p className="text-sm">A timeline a betoltott feladatokbol epul fel.</p>
          </div>
        </div>
      </div>
    );
  }

  const rangeStart = items.reduce((min, item) => item.start < min ? item.start : min, items[0].start);
  const rangeEnd = items.reduce((max, item) => item.end > max ? item.end : max, items[0].end);
  const start = toStartOfDay(rangeStart);
  const end = toStartOfDay(rangeEnd);
  const totalDays = Math.max(1, getDayOffset(start, end) + 1);
  const tickStep = totalDays <= 10 ? 1 : totalDays <= 30 ? 3 : 7;

  const ticks: Date[] = [];
  for (let offset = 0; offset < totalDays; offset += tickStep) {
    ticks.push(new Date(start.getTime() + offset * DAY_MS));
  }
  if (ticks[ticks.length - 1].getTime() !== end.getTime()) {
    ticks.push(end);
  }

  return (
    <div className="flex h-[calc(100vh-250px)] flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-sm">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Idovonal</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {formatShortDate(start)} - {formatShortDate(end)}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
          <Clock size={15} />
          <span>{items.length} feladat</span>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(240px,320px)_1fr] border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
          Feladat
        </div>
        <div className="relative min-h-[52px] px-4 py-3">
          {ticks.map((tick) => {
            const left = `${(getDayOffset(start, tick) / totalDays) * 100}%`;
            return (
              <div
                key={tick.toISOString()}
                className="absolute bottom-3 top-3"
                style={{left}}
              >
                <div className="absolute inset-y-0 border-l border-dashed border-[var(--border-subtle)]" />
                <span className="absolute -top-1 left-2 whitespace-nowrap text-xs font-medium text-[var(--text-tertiary)]">
                  {formatShortDate(tick)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {items.map((item) => {
          const startOffset = getDayOffset(start, item.start);
          const duration = Math.max(1, getDayOffset(item.start, item.end) + 1);
          const left = `${(startOffset / totalDays) * 100}%`;
          const width = `${Math.max((duration / totalDays) * 100, 3)}%`;
          const barColor = STATUS_BAR_COLORS[item.task.status] || 'from-orange-500 to-amber-500';

          return (
            <div
              key={item.id}
              className="grid grid-cols-[minmax(240px,320px)_1fr] border-b border-[var(--border-subtle)] last:border-b-0"
            >
              <button
                type="button"
                onClick={() => onTaskClick(item.task)}
                className="flex min-w-0 flex-col gap-1 px-4 py-4 text-left transition-colors hover:bg-[var(--bg-hover)]"
              >
                <span className="truncate font-medium text-[var(--text-primary)]">{item.name}</span>
                <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                  <span className="rounded-full bg-[var(--bg-primary)] px-2 py-0.5">
                    {STATUS_LABELS[item.task.status as keyof typeof STATUS_LABELS] || item.task.status}
                  </span>
                  <span>{formatShortDate(item.start)} - {formatShortDate(item.end)}</span>
                </div>
              </button>

              <div className="relative min-h-[72px] px-4 py-4">
                {ticks.map((tick) => {
                  const tickLeft = `${(getDayOffset(start, tick) / totalDays) * 100}%`;
                  return (
                    <div
                      key={`${item.id}-${tick.toISOString()}`}
                      className="absolute inset-y-0"
                      style={{left: tickLeft}}
                    >
                      <div className="h-full border-l border-dashed border-[var(--border-subtle)]" />
                    </div>
                  );
                })}

                <button
                  type="button"
                  disabled={item.isDisabled}
                  onClick={() => onTaskClick(item.task)}
                  className={clsx(
                    'absolute top-1/2 h-9 -translate-y-1/2 overflow-hidden rounded-full bg-gradient-to-r shadow-sm transition-transform',
                    barColor,
                    !item.isDisabled && 'hover:scale-[1.01]'
                  )}
                  style={{left, width}}
                  title={item.name}
                >
                  <span
                    className="absolute inset-y-0 left-0 bg-black/15"
                    style={{width: `${item.progress}%`}}
                  />
                  <span className="relative flex h-full items-center px-3 text-xs font-semibold text-white">
                    {item.task.issue_key || item.name}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
