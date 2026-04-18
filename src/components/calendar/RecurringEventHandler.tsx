/** Recurring event edit scope chooser for single/future/all updates. */
'use client';

import type { RecurringScope } from '@/src/types/calendar.types';

/**
 * Props for recurring scope selection.
 */
export interface RecurringEventHandlerProps {
  value: RecurringScope;
  onChange: (scope: RecurringScope) => void;
}

export default function RecurringEventHandler({ value, onChange }: RecurringEventHandlerProps) {
  return (
    <div className="grid gap-1">
      <label className="text-xs text-[var(--text-secondary)]">Recurring update scope</label>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Recurring event update scope">
        <button
          type="button"
          role="radio"
          aria-checked={value === 'single'}
          onClick={() => onChange('single')}
          className={`rounded-md border px-3 py-2 text-sm ${value === 'single' ? 'border-[var(--accent)] text-[var(--text-primary)]' : 'border-[var(--border-default)] text-[var(--text-secondary)]'}`}
        >
          Csak ezt
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={value === 'future'}
          onClick={() => onChange('future')}
          className={`rounded-md border px-3 py-2 text-sm ${value === 'future' ? 'border-[var(--accent)] text-[var(--text-primary)]' : 'border-[var(--border-default)] text-[var(--text-secondary)]'}`}
        >
          Ezt és jövőbelieket
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={value === 'all'}
          onClick={() => onChange('all')}
          className={`rounded-md border px-3 py-2 text-sm ${value === 'all' ? 'border-[var(--accent)] text-[var(--text-primary)]' : 'border-[var(--border-default)] text-[var(--text-secondary)]'}`}
        >
          Összes
        </button>
      </div>
    </div>
  );
}
