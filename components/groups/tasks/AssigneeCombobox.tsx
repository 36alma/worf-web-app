'use client';

import {useState, useRef, useEffect, useMemo} from 'react';
import {useTranslations} from 'next-intl';
import {Command} from 'cmdk';
import * as Popover from '@radix-ui/react-popover';
import {Check, ChevronsUpDown, UserCircle, X} from 'lucide-react';
import clsx from 'clsx';
import {GroupUser} from './types';

const AVATAR_COLORS = [
  'bg-orange-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-cyan-500', 'bg-violet-500', 'bg-pink-500', 'bg-teal-500',
  'bg-blue-500', 'bg-orange-500', 'bg-fuchsia-500', 'bg-lime-500'
];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return '??';
}

function UserAvatar({user, size = 'sm'}: {user: GroupUser; size?: 'sm' | 'md'}) {
  const sizeClass = size === 'md' ? 'h-7 w-7 text-[11px]' : 'h-5 w-5 text-[10px]';

  return (
    <span
      className={clsx(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full bg-surface-2 font-medium text-fg-secondary',
        sizeClass
      )}
    >
      {getInitials(user.full_name || user.username)}
    </span>
  );
}

export interface AssigneeComboboxProps {
  users: GroupUser[];
  value: string | null;
  onChange: (userId: string | null) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
}

export default function AssigneeCombobox({
  users,
  value,
  onChange,
  disabled = false,
  loading = false,
  placeholder
}: AssigneeComboboxProps) {
  const t = useTranslations('tasks');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedUser = useMemo(
    () => users.find((user) => user.user_id === value) ?? null,
    [users, value]
  );

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const handleSelect = (userId: string | null) => {
    onChange(userId);
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-label={t('form.assignee')}
          className={clsx(
            'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-150',
            'bg-[var(--bg-surface)] text-[var(--text-primary)]',
            open
              ? 'border-border-focus ring-2 ring-accent/50'
              : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]',
            disabled && 'cursor-not-allowed opacity-50',
            !disabled && 'cursor-pointer'
          )}
        >
          {loading ? (
            <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-accent" />
          ) : selectedUser ? (
            <UserAvatar user={selectedUser} />
          ) : (
            <UserCircle size={18} className="shrink-0 text-[var(--text-tertiary)]" />
          )}

          <span className={clsx('flex-1 truncate text-left', !selectedUser && 'text-[var(--text-tertiary)]')}>
            {selectedUser ? selectedUser.full_name || selectedUser.username : (placeholder ?? t('form.assigneePlaceholder'))}
          </span>

          {selectedUser && !disabled && (
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
          className={clsx(
            'z-[100] w-[var(--radix-popover-trigger-width)] min-w-[280px] max-w-[400px]',
            'rounded-lg border border-border bg-surface-2',
            'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150'
          )}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <Command
            className="flex flex-col"
            filter={(candidate, query) => {
              const user = users.find((entry) => entry.user_id === candidate);
              if (!user) return candidate === '__unassigned__' && query === '' ? 1 : 0;
              const normalizedQuery = query.toLowerCase();
              const nameMatch = (user.full_name || '').toLowerCase().includes(normalizedQuery);
              const usernameMatch = (user.username || '').toLowerCase().includes(normalizedQuery);
              const emailMatch = (user.email || '').toLowerCase().includes(normalizedQuery);
              return nameMatch || usernameMatch || emailMatch ? 1 : 0;
            }}
          >
            <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2.5">
              <svg width="15" height="15" viewBox="0 0 15 15" className="shrink-0 text-[var(--text-tertiary)]">
                <path
                  d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.3 10.007C8.49 10.635 7.49 11 6.5 11C4.015 11 2 8.985 2 6.5C2 4.015 4.015 2 6.5 2C8.985 2 11 4.015 11 6.5C11 7.525 10.614 8.467 9.987 9.182L13.15 12.354C13.34 12.544 13.34 12.856 13.15 13.047C12.96 13.237 12.647 13.237 12.457 13.047L9.3 10.007Z"
                  fill="currentColor"
                  fillRule="evenodd"
                  clipRule="evenodd"
                />
              </svg>
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder={t('form.assigneeSearchPlaceholder')}
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
              />
            </div>

            <Command.List className="max-h-[240px] overflow-y-auto overscroll-contain px-1.5 py-1.5">
              <Command.Empty className="py-6 text-center text-sm text-[var(--text-tertiary)]">
                {t('common.noResults')}
              </Command.Empty>

              <Command.Item
                value="__unassigned__"
                onSelect={() => handleSelect(null)}
                className={clsx(
                  'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                  'data-[selected=true]:bg-[var(--bg-active)]',
                  'hover:bg-[var(--bg-hover)]',
                  value === null && 'bg-[var(--bg-active)]'
                )}
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2">
                  <X size={11} className="text-fg-muted" />
                </span>
                <span className="flex-1 font-medium text-[var(--text-secondary)]">{t('form.unassigned')}</span>
                {value === null && <Check size={14} className="shrink-0 text-accent" />}
              </Command.Item>

              {users.length > 0 && <div className="mx-1 my-1 h-px bg-[var(--border-subtle)]" />}

              {users.map((user) => (
                <Command.Item
                  key={user.user_id}
                  value={user.user_id}
                  onSelect={() => handleSelect(user.user_id)}
                  className={clsx(
                    'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                    'data-[selected=true]:bg-[var(--bg-active)]',
                    'hover:bg-[var(--bg-hover)]',
                    value === user.user_id && 'bg-[var(--bg-active)]'
                  )}
                >
                  <UserAvatar user={user} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-[var(--text-primary)]">
                      {user.full_name || user.username}
                    </div>
                    {user.username && user.full_name && (
                      <div className="truncate text-[11px] text-[var(--text-tertiary)]">
                        @{user.username}
                      </div>
                    )}
                  </div>
                  {value === user.user_id && <Check size={14} className="shrink-0 text-accent" />}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export {UserAvatar, getInitials, AVATAR_COLORS, hashCode};
