'use client';

import {useId, useMemo, useState} from 'react';

export interface ComboboxOption {
  id: string;
  label: string;
}

interface MemberComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  emptyText: string;
  ariaLabel: string;
  disabled?: boolean;
}

/** Searchable single-select (ARIA 1.2 combobox with a listbox that stays in the layout flow, so the modal never clips it). */
export default function MemberCombobox({
  options,
  value,
  onChange,
  placeholder,
  emptyText,
  ariaLabel,
  disabled
}: MemberComboboxProps) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const selected = options.find((option) => option.id === value) ?? null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? options.filter((option) => option.label.toLowerCase().includes(needle)) : options;
  }, [options, query]);

  const pick = (option: ComboboxOption) => {
    onChange(option.id);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="relative min-w-0 flex-1">
      <input
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${listId}-${filtered[active].id}` : undefined}
        disabled={disabled}
        value={open ? query : (selected?.label ?? '')}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
          if (value) onChange('');
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setActive((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, 0));
          } else if (event.key === 'Enter' && open && filtered[active]) {
            event.preventDefault();
            pick(filtered[active]);
          } else if (event.key === 'Escape' && open) {
            // Keep the dialog open: the first Escape only closes the list.
            event.stopPropagation();
            setOpen(false);
          }
        }}
        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-1"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[var(--text-tertiary)]">{emptyText}</li>
          ) : (
            filtered.map((option, index) => (
              <li
                key={option.id}
                id={`${listId}-${option.id}`}
                role="option"
                aria-selected={option.id === value}
                // mouseDown (not click) so the input's blur does not close the list before the pick lands.
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(option);
                }}
                onMouseEnter={() => setActive(index)}
                className={`cursor-pointer px-3 py-2 text-sm text-[var(--text-primary)] ${
                  index === active ? 'bg-[var(--bg-hover)]' : ''
                }`}
              >
                {option.label}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
