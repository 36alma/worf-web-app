import clsx from 'clsx';

export default function Badge({
  children,
  color = 'slate'
}: {
  children: React.ReactNode;
  color?: 'slate' | 'indigo' | 'cyan' | 'red' | 'green' | 'yellow';
}) {
  return (
    <span
      className={clsx(
        'rounded px-2 py-1 text-xs font-medium',
        color === 'slate' && 'bg-slate-700/50 text-slate-200',
        color === 'indigo' && 'bg-indigo-500/20 text-indigo-200',
        color === 'cyan' && 'bg-cyan-500/20 text-cyan-100',
        color === 'red' && 'bg-red-500/20 text-red-100',
        color === 'green' && 'bg-green-500/20 text-green-100',
        color === 'yellow' && 'bg-amber-500/20 text-amber-100'
      )}
    >
      {children}
    </span>
  );
}
