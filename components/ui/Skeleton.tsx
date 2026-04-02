export interface SkeletonProps {
  className?: string;
}

export default function Skeleton({className = 'h-6 w-full'}: SkeletonProps) {
  return <div className={`skeleton-shimmer rounded-[var(--radius-md)] ${className}`} />;
}
