import { ButtonHTMLAttributes, ReactNode, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border font-medium transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // accent lives ONLY on the primary CTA (spec §1) — max one per view
        primary: 'border-transparent bg-accent text-white hover:bg-accent-hover',
        secondary: 'border-border-strong bg-transparent text-fg hover:bg-surface-2',
        danger: 'border-border-strong bg-transparent text-danger hover:bg-surface-2',
        ghost: 'border-transparent bg-transparent text-fg-secondary hover:bg-surface-2 hover:text-fg',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-9 px-3.5 text-sm',
        lg: 'h-10 px-4 text-sm',
      },
    },
    // secondary is the default / most common button (spec §5)
    defaultVariants: { variant: 'secondary', size: 'md' },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, className, children, startIcon, endIcon, loading, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : startIcon}
      {children != null && children !== false && <span>{children}</span>}
      {!loading && endIcon}
    </button>
  );
});

export default Button;
export { buttonVariants };
