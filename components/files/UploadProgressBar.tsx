'use client';

import * as Progress from '@radix-ui/react-progress';

export interface UploadProgressBarProps {
  /** 0-100 */
  value: number;
  label?: string;
}

/** Thin `@radix-ui/react-progress` wrapper styled with the project's CSS-variable tokens. */
export default function UploadProgressBar({ value, label }: UploadProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
          <span>{label}</span>
          <span>{Math.round(clamped)}%</span>
        </div>
      )}
      <Progress.Root
        value={clamped}
        className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]"
      >
        <Progress.Indicator
          className="block h-full w-full bg-[var(--accent)] transition-transform duration-200 ease-out"
          style={{ transform: `translateX(-${100 - clamped}%)` }}
        />
      </Progress.Root>
    </div>
  );
}
