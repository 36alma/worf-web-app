import type { ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

// Muted tint badge: dark -bg tint + own-family text (spec §5). Never solid + white.
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-caption font-medium',
  {
    variants: {
      variant: {
        neutral: 'bg-surface-2 text-fg-secondary',
        success: 'bg-success-bg text-success',
        warning: 'bg-warning-bg text-warning',
        danger: 'bg-danger-bg text-danger',
        info: 'bg-info-bg text-info',
        accent: 'bg-accent-muted text-[color:var(--badge-accent-text)]',
      },
    },
    defaultVariants: { variant: 'neutral' },
  }
);

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

// Back-compat: the previous API took a `color` prop. Map it onto semantic variants.
const legacyColorMap: Record<string, BadgeVariant> = {
  slate: 'neutral',
  gray: 'neutral',
  indigo: 'accent',
  orange: 'accent',
  cyan: 'info',
  blue: 'info',
  red: 'danger',
  green: 'success',
  yellow: 'warning',
};

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  /** @deprecated use `variant` */
  color?: string;
  icon?: ReactNode;
  className?: string;
}

export default function Badge({ children, variant, color, icon, className }: BadgeProps) {
  const resolved: BadgeVariant =
    variant ?? (color ? legacyColorMap[color] ?? 'neutral' : 'neutral');
  return (
    <span className={cn(badgeVariants({ variant: resolved }), className)}>
      {icon}
      {children}
    </span>
  );
}

export { badgeVariants };
