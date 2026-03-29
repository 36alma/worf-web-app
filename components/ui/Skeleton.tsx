export default function Skeleton({className = 'h-6 w-full'}: {className?: string}) {
  return <div className={`animate-pulse rounded bg-slate-800/70 ${className}`} />;
}
