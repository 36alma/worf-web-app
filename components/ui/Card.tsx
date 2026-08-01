import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** adds hover border-strong + transition for clickable cards */
  interactive?: boolean;
}

// Hairline card: bg-surface-1 + border, no shadow (spec §5).
const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, interactive, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border border-border bg-surface-1 p-3',
        interactive && 'transition-colors hover:border-border-strong',
        className
      )}
      {...props}
    />
  );
});

export default Card;
