'use client';

import { useState, type ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import SideSheet from '@/components/ui/SideSheet';

export interface ActionMenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  variant?: 'danger';
  disabled?: boolean;
  hidden?: boolean;
}

export interface EntryActionsMenuProps {
  items: ActionMenuItem[];
  triggerLabel: string;
  sheetTitle: string;
  /**
   * Controls the mobile bottom sheet from outside (e.g. a long-press
   * handler on the row/card). Omit for the default uncontrolled
   * kebab-button-only behavior.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function EntryActionsMenu({ items, triggerLabel, sheetTitle, open, onOpenChange }: EntryActionsMenuProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [internalSheetOpen, setInternalSheetOpen] = useState(false);
  const sheetOpen = open ?? internalSheetOpen;
  const setSheetOpen = onOpenChange ?? setInternalSheetOpen;
  const visibleItems = items.filter((item) => !item.hidden);

  if (visibleItems.length === 0) return null;

  if (isDesktop) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={triggerLabel}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)]"
        >
          <MoreVertical size={16} strokeWidth={1.75} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {visibleItems.map((item) => (
            <DropdownMenuItem
              key={item.key}
              disabled={item.disabled}
              variant={item.variant === 'danger' ? 'danger' : 'default'}
              onSelect={item.onSelect}
            >
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label={triggerLabel}
        onClick={() => setSheetOpen(true)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)]"
      >
        <MoreVertical size={18} strokeWidth={1.75} />
      </button>
      <SideSheet open={sheetOpen} title={sheetTitle} onClose={() => setSheetOpen(false)}>
        <div className="flex flex-col gap-1">
          {visibleItems.map((item) => (
            <button
              key={item.key}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                setSheetOpen(false);
                item.onSelect();
              }}
              className={`flex h-11 items-center gap-3 rounded-[var(--radius-md)] px-3 text-left text-sm disabled:opacity-50 ${
                item.variant === 'danger' ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'
              } hover:bg-[var(--bg-hover)]`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </SideSheet>
    </>
  );
}
