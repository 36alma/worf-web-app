import {ButtonHTMLAttributes} from 'react';
import clsx from 'clsx';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
};

export default function Button({variant = 'primary', className, ...props}: Props) {
  return (
    <button
      {...props}
      className={clsx(
        'rounded-md px-3 py-2 text-sm font-medium transition disabled:opacity-50',
        variant === 'primary' && 'bg-indigo-500 text-white hover:bg-indigo-400',
        variant === 'secondary' && 'bg-cyan-500 text-slate-900 hover:bg-cyan-400',
        variant === 'danger' && 'bg-red-500/20 text-red-200 hover:bg-red-500/30',
        variant === 'ghost' && 'border border-[var(--border)] bg-transparent text-slate-200 hover:bg-slate-800',
        className
      )}
    />
  );
}
