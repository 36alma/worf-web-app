import React from 'react';
import { Bug, BookOpen, Zap, Layers, CheckSquare } from 'lucide-react';
import clsx from 'clsx';
import {useTranslations} from 'next-intl';
import {translateTaskType} from '@/lib/i18n/tasks';

export interface TaskTypeBadgeProps {
  task_type?: string | null;
  issue_key?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Muted tint (dark -bg + own-family icon) from the semantic palette — no raw Tailwind colors.
const TASK_TYPE_CONFIG: Record<string, { icon: React.ElementType; cls: string }> = {
  BUG: { icon: Bug, cls: 'bg-danger-bg text-danger' },
  STORY: { icon: BookOpen, cls: 'bg-success-bg text-success' },
  EPIC: { icon: Zap, cls: 'bg-info-bg text-info' },
  SUBTASK: { icon: Layers, cls: 'bg-warning-bg text-warning' },
  TASK: { icon: CheckSquare, cls: 'bg-surface-2 text-fg-secondary' },
};

const DEFAULT_CONFIG = { icon: CheckSquare, cls: 'bg-surface-2 text-fg-muted' };

export default function TaskTypeBadge({
  task_type,
  issue_key,
  size = 'md',
  className,
}: TaskTypeBadgeProps) {
  const t = useTranslations('tasks');
  const config =
    (task_type && TASK_TYPE_CONFIG[task_type.toUpperCase()]) || DEFAULT_CONFIG;

  const Icon = config.icon;

  const sizeClasses = {
    sm: { box: 'w-5 h-5 rounded-sm', icon: 12, text: 'text-caption' },
    md: { box: 'w-6 h-6 rounded-md', icon: 14, text: 'text-sm' },
    lg: { box: 'w-8 h-8 rounded-md', icon: 18, text: 'text-base' },
  };

  const currSize = sizeClasses[size];

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div
        className={clsx('flex shrink-0 items-center justify-center', currSize.box, config.cls)}
      >
        <Icon size={currSize.icon} />
      </div>
      {issue_key && (
        <span
          className={clsx('font-medium text-fg', currSize.text)}
          title={task_type ? translateTaskType(t, task_type.toUpperCase()) : undefined}
        >
          {issue_key}
        </span>
      )}
    </div>
  );
}
