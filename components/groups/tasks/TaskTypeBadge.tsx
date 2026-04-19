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

const TASK_TYPE_CONFIG: Record<string, { icon: React.ElementType, color: string, bg: string }> = {
  BUG: { icon: Bug, color: 'text-red-500', bg: 'bg-red-500/15 dark:bg-red-500/10' },
  STORY: { icon: BookOpen, color: 'text-green-500', bg: 'bg-green-500/15 dark:bg-green-500/10' },
  EPIC: { icon: Zap, color: 'text-purple-500', bg: 'bg-purple-500/15 dark:bg-purple-500/10' },
  SUBTASK: { icon: Layers, color: 'text-teal-500 dark:text-teal-400', bg: 'bg-teal-500/15 dark:bg-teal-400/10' },
  TASK: { icon: CheckSquare, color: 'text-orange-500', bg: 'bg-orange-500/15 dark:bg-orange-500/10' },
};

export default function TaskTypeBadge({ 
  task_type, 
  issue_key, 
  size = 'md',
  className 
}: TaskTypeBadgeProps) {
  const t = useTranslations('tasks');
  const config = task_type && TASK_TYPE_CONFIG[task_type.toUpperCase()] 
    ? TASK_TYPE_CONFIG[task_type.toUpperCase()] 
    : { icon: CheckSquare, color: 'text-gray-400', bg: 'bg-gray-500/10' };

  const Icon = config.icon;

  const sizeClasses = {
    sm: { box: 'w-5 h-5 rounded', icon: 12, text: 'text-xs' },
    md: { box: 'w-6 h-6 rounded-md', icon: 14, text: 'text-sm' },
    lg: { box: 'w-8 h-8 rounded-md', icon: 18, text: 'text-lg' },
  };

  const currSize = sizeClasses[size];

  return (
    <div className={clsx("flex items-center gap-2", className)}>
      <div 
        className={clsx(
          "flex items-center justify-center shrink-0 border border-transparent dark:border-white/5", 
          currSize.box,
          config.color,
          config.bg
        )}
      >
        <Icon size={currSize.icon} />
      </div>
      {issue_key && (
        <span
          className={clsx("font-bold text-[var(--text-primary)]", currSize.text)}
          title={task_type ? translateTaskType(t, task_type.toUpperCase()) : undefined}
        >
          {issue_key}
        </span>
      )}
    </div>
  );
}
