import { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import { Plus } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  startIcon?: ReactNode;
  endIcon?: ReactNode;
}

export default function Button({
  variant = 'primary',
  className,
  children,
  startIcon,
  endIcon,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex h-[var(--btn-height-md)] items-center justify-center gap-2 rounded-[var(--btn-radius)] border px-[var(--btn-padding)] text-sm font-medium active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'border-transparent bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]',
        variant === 'secondary' &&
        'border-[var(--border-default)] bg-transparent text-[var(--text-primary)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]',
        variant === 'danger' &&
        'border-[var(--border-default)] bg-transparent text-[var(--error)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]',
        variant === 'ghost' && 'border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
        className
      )}
    >
      <div className='flex items-center'>
        <div className='pr-2 pl-3'>{startIcon}</div>
        <span className="p-2">{children}</span>
        <div className='pr-3 pl-2'>{endIcon}</div>
      </div>
    </button>
  );
}
