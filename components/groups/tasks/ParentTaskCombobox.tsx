'use client';

import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Command} from 'cmdk';
import * as Popover from '@radix-ui/react-popover';
import {Check, ChevronsUpDown, X} from 'lucide-react';
import clsx from 'clsx';
import {getTaskPanel} from '@/lib/api/tasks';
import {Task} from './types';

export interface ParentTaskComboboxProps {
  groupId: string;
  value: string | null;
  onChange: (taskId: string | null) => void;
  /** A szerkesztett feladat ID-ja — saját magát nem lehet szülőnek választani. */
  excludeTaskId?: string;
  disabled?: boolean;
}

// A backend 100-nál levágja a load_task_number-t.
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

export default function ParentTaskCombobox({groupId, value, onChange, excludeTaskId, disabled = false}: ParentTaskComboboxProps) {
  const t = useTranslations('tasks');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const labelRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [nameFits, setNameFits] = useState(true);
  const refreshedFor = useRef<string | null>(null);

  // Első megnyitáskor (vagy ha már van kiválasztott szülő, a címke miatt) betöltjük a feladatokat.
  useEffect(() => {
    if (!open && !value) return;
    // Ha a kiválasztott szülő nincs a betöltött listában (pl. frissen jött létre), egyszer újratöltjük.
    const stale = !!value && refreshedFor.current !== value && !tasks.some((task) => task.id === value);
    if (loaded && !stale) return;
    refreshedFor.current = value;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        let all: Task[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const response = await getTaskPanel({group_id: groupId, page_number: page, load_task_number: PAGE_SIZE});
          const data = response.data?.data || response.data || {};
          const list = Array.isArray(data.tasks) ? data.tasks : Array.isArray(data) ? data : [];
          all = all.concat(list.map((task: any) => ({...task, id: task.id || task.task_id})));
          totalPages = typeof data.total_pages === 'number' ? data.total_pages : 1;
          page += 1;
        } while (page <= totalPages && page <= MAX_PAGES);
        if (!cancelled) {
          setTasks(all);
          setLoaded(true);
        }
      } catch {
        // csendben hagyjuk: üres találati lista jelenik meg
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, value, loaded, groupId, tasks]);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const candidates = useMemo(
    () => tasks.filter((task) => task.id !== excludeTaskId && task.task_type !== 'SUBTASK'),
    [tasks, excludeTaskId]
  );
  const selected = useMemo(() => tasks.find((task) => task.id === value) ?? null, [tasks, value]);

  // A feladat nevét mutatjuk, ha kifér; különben csak az azonosítóját.
  useLayoutEffect(() => {
    const label = labelRef.current;
    const measure = measureRef.current;
    if (!label || !measure) return;
    const update = () => setNameFits(measure.offsetWidth <= label.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(label);
    return () => observer.disconnect();
  }, [selected, value]);

  const handleSelect = (taskId: string | null) => {
    onChange(taskId);
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-label={t('form.parentTask')}
          className={clsx(
            'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-150',
            'bg-[var(--bg-surface)] text-[var(--text-primary)]',
            open ? 'border-border-focus ring-2 ring-accent/50' : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]',
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
          )}
        >
          <span ref={labelRef} className={clsx('relative min-w-0 flex-1 truncate text-left', !value && 'text-[var(--text-tertiary)]')}>
            {value
              ? selected
                ? nameFits
                  ? selected.summary || selected.issue_key
                  : <span className="font-mono text-xs">{selected.issue_key}</span>
                : '…'
              : t('form.parentTaskPlaceholder')}
            {selected && (
              <span ref={measureRef} aria-hidden className="invisible absolute left-0 top-0 whitespace-nowrap">
                {selected.summary || selected.issue_key}
              </span>
            )}
          </span>
          {value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(event) => {
                event.stopPropagation();
                handleSelect(null);
              }}
              className="rounded p-0.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              <X size={14} />
            </span>
          )}
          <ChevronsUpDown size={14} className="shrink-0 text-[var(--text-tertiary)]" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-[100] w-[var(--radix-popover-trigger-width)] min-w-[280px] max-w-[440px] rounded-lg border border-border bg-surface-2 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <Command
            className="flex flex-col"
            filter={(candidate, query) => {
              const task = candidates.find((entry) => entry.id === candidate);
              if (!task) return 0;
              const q = query.trim().toLowerCase();
              return task.issue_key.toLowerCase().includes(q) || (task.summary || '').toLowerCase().includes(q) ? 1 : 0;
            }}
          >
            <div className="border-b border-[var(--border-subtle)] px-3 py-2.5">
              <Command.Input
                value={search}
                onValueChange={setSearch}
                autoFocus
                placeholder={t('form.parentTaskSearchPlaceholder')}
                className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
              />
            </div>
            <Command.List className="max-h-[240px] overflow-y-auto overscroll-contain px-1.5 py-1.5">
              {loading ? (
                <div className="py-6 text-center text-sm text-[var(--text-tertiary)]">…</div>
              ) : (
                <Command.Empty className="py-6 text-center text-sm text-[var(--text-tertiary)]">
                  {t('common.noResults')}
                </Command.Empty>
              )}
              {candidates.map((task) => (
                <Command.Item
                  key={task.id}
                  value={task.id}
                  onSelect={() => handleSelect(task.id)}
                  className={clsx(
                    'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                    'data-[selected=true]:bg-[var(--bg-active)] hover:bg-[var(--bg-hover)]',
                    value === task.id && 'bg-[var(--bg-active)]'
                  )}
                >
                  <span className="shrink-0 font-mono text-xs text-[var(--text-tertiary)]">{task.issue_key}</span>
                  <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">{task.summary}</span>
                  {value === task.id && <Check size={14} className="shrink-0 text-accent" />}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
