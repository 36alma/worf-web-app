import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface EmptyStateProps {
  children: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** compact dashed placeholder ~64px (spec §5). Set false for a taller variant. */
  compact?: boolean;
}

// Compact, action-oriented empty state: dashed hairline, muted text (spec §5, §8/3).
export default function EmptyState({
  children,
  icon,
  action,
  className,
  compact = true,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-center text-caption text-fg-muted',
        compact ? 'min-h-[64px] px-3 py-4' : 'min-h-[160px] p-6',
        className
      )}
    >
      {icon}
      <span>{children}</span>
      {action}
    </div>
  );
}
