'use client';

import {useState, useRef, useEffect, useMemo} from 'react';
import {Command} from 'cmdk';
import * as Popover from '@radix-ui/react-popover';
import {Check, ChevronsUpDown, UserCircle, X} from 'lucide-react';
import clsx from 'clsx';
import {GroupUser} from './types';

// ── Avatar color palette (deterministic based on user_id hash) ──
const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-cyan-500', 'bg-violet-500', 'bg-pink-500', 'bg-teal-500',
  'bg-blue-500', 'bg-orange-500', 'bg-fuchsia-500', 'bg-lime-500',
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
  const colorClass = AVATAR_COLORS[hashCode(user.user_id) % AVATAR_COLORS.length];
  const sizeClass = size === 'md' ? 'h-7 w-7 text-[11px]' : 'h-5 w-5 text-[10px]';

  return (
    <span className={clsx(
      'inline-flex items-center justify-center rounded-full font-bold text-white shrink-0 select-none',
      colorClass, sizeClass
    )}>
      {getInitials(user.full_name || user.username)}
    </span>
  );
}

// ── Main Component ──

export interface AssigneeComboboxProps {
  /** All available users for this group */
  users: GroupUser[];
  /** Currently selected user ID (null = unassigned) */
  value: string | null;
  /** Called when user selects a new assignee */
  onChange: (userId: string | null) => void;
  /** If true, the combobox is disabled (read-only) */
  disabled?: boolean;
  /** If true, show a loading spinner over the trigger */
  loading?: boolean;
  /** Optional placeholder text */
  placeholder?: string;
}

export default function AssigneeCombobox({
  users,
  value,
  onChange,
  disabled = false,
  loading = false,
  placeholder = 'Felelős kiválasztása...',
}: AssigneeComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Find selected user
  const selectedUser = useMemo(
    () => users.find(u => u.user_id === value) ?? null,
    [users, value]
  );

  // Reset search when popover closes
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
          aria-label="Felelős kiválasztása"
          className={clsx(
            'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-150',
            'bg-[var(--bg-primary)] text-[var(--text-primary)]',
            open
              ? 'border-indigo-500 ring-2 ring-indigo-500/20'
              : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]',
            disabled && 'opacity-50 cursor-not-allowed',
            !disabled && 'cursor-pointer'
          )}
        >
          {loading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-indigo-500 shrink-0" />
          ) : selectedUser ? (
            <UserAvatar user={selectedUser} />
          ) : (
            <UserCircle size={18} className="text-[var(--text-tertiary)] shrink-0" />
          )}

          <span className={clsx(
            'flex-1 text-left truncate',
            !selectedUser && 'text-[var(--text-tertiary)]'
          )}>
            {selectedUser
              ? selectedUser.full_name || selectedUser.username
              : placeholder}
          </span>

          {/* Clear button */}
          {selectedUser && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(null);
              }}
              className="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={14} />
            </span>
          )}

          <ChevronsUpDown size={14} className="text-[var(--text-tertiary)] shrink-0" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className={clsx(
            'z-[100] w-[var(--radix-popover-trigger-width)] min-w-[280px] max-w-[400px]',
            'rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-xl',
            'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150'
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command
            className="flex flex-col"
            filter={(value, search) => {
              const user = users.find(u => u.user_id === value);
              if (!user) return value === '__unassigned__' && search === '' ? 1 : 0;
              const q = search.toLowerCase();
              const nameMatch = (user.full_name || '').toLowerCase().includes(q);
              const usernameMatch = (user.username || '').toLowerCase().includes(q);
              const emailMatch = (user.email || '').toLowerCase().includes(q);
              return (nameMatch || usernameMatch || emailMatch) ? 1 : 0;
            }}
          >
            {/* Search Input */}
            <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2.5">
              <svg width="15" height="15" viewBox="0 0 15 15" className="text-[var(--text-tertiary)] shrink-0">
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
                placeholder="Keresés név vagy email alapján..."
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
              />
            </div>

            <Command.List className="max-h-[240px] overflow-y-auto overscroll-contain py-1.5 px-1.5">
              <Command.Empty className="py-6 text-center text-sm text-[var(--text-tertiary)]">
                Nincs találat.
              </Command.Empty>

              {/* Unassigned option — always first */}
              <Command.Item
                value="__unassigned__"
                onSelect={() => handleSelect(null)}
                className={clsx(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm cursor-pointer transition-colors',
                  'data-[selected=true]:bg-indigo-50 data-[selected=true]:dark:bg-indigo-900/20',
                  'hover:bg-[var(--bg-hover)]',
                  value === null && 'bg-indigo-50/60 dark:bg-indigo-950/30'
                )}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0">
                  <X size={11} className="text-zinc-500 dark:text-zinc-400" />
                </span>
                <span className="flex-1 font-medium text-[var(--text-secondary)]">Nincs hozzárendelve</span>
                {value === null && (
                  <Check size={14} className="text-indigo-500 shrink-0" />
                )}
              </Command.Item>

              {/* Separator */}
              {users.length > 0 && (
                <div className="my-1 h-px bg-[var(--border-subtle)] mx-1" />
              )}

              {/* User list */}
              {users.map(user => (
                <Command.Item
                  key={user.user_id}
                  value={user.user_id}
                  onSelect={() => handleSelect(user.user_id)}
                  className={clsx(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm cursor-pointer transition-colors',
                    'data-[selected=true]:bg-indigo-50 data-[selected=true]:dark:bg-indigo-900/20',
                    'hover:bg-[var(--bg-hover)]',
                    value === user.user_id && 'bg-indigo-50/60 dark:bg-indigo-950/30'
                  )}
                >
                  <UserAvatar user={user} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[var(--text-primary)] truncate">
                      {user.full_name || user.username}
                    </div>
                    {user.username && user.full_name && (
                      <div className="text-[11px] text-[var(--text-tertiary)] truncate">
                        @{user.username}
                      </div>
                    )}
                  </div>
                  {value === user.user_id && (
                    <Check size={14} className="text-indigo-500 shrink-0" />
                  )}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// Export the helper for use in TaskDetailModal
export {UserAvatar, getInitials, AVATAR_COLORS, hashCode};
