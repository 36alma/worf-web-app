import clsx from 'clsx';
import type {ReactNode} from 'react';
import {AlertTriangle, CheckCircle2, Dot, Info} from 'lucide-react';

export interface BadgeProps {
  children: ReactNode;
  color?: 'slate' | 'indigo' | 'cyan' | 'red' | 'green' | 'yellow';
}

export default function Badge({children, color = 'slate'}: BadgeProps) {
  const icon =
    color === 'green' ? (
      <CheckCircle2 size={12} strokeWidth={1.75} />
    ) : color === 'red' || color === 'yellow' ? (
      <AlertTriangle size={12} strokeWidth={1.75} />
    ) : color === 'cyan' ? (
      <Info size={12} strokeWidth={1.75} />
    ) : (
      <Dot size={12} strokeWidth={1.75} />
    );

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium',
        color === 'slate' && 'bg-[var(--badge-gray-bg)] text-[var(--badge-gray-text)]',
        color === 'indigo' && 'bg-[var(--badge-orange-bg)] text-[var(--badge-orange-text)]',
        color === 'cyan' && 'bg-[var(--badge-blue-bg)] text-[var(--badge-blue-text)]',
        color === 'red' && 'bg-[rgba(229,72,77,0.12)] text-[var(--error)]',
        color === 'green' && 'bg-[var(--badge-green-bg)] text-[var(--badge-green-text)]',
        color === 'yellow' && 'bg-[rgba(229,160,0,0.12)] text-[var(--warning)]'
      )}
    >
      {icon}
      {children}
    </span>
  );
}
