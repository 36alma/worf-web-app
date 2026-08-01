import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@/lib/utils/cn';

const sizeMap = {
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-caption',
  lg: 'size-10 text-sm',
} as const;

export interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: keyof typeof sizeMap;
  className?: string;
}

function initials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

// Neutral grey avatar with initials fallback (spec §5: no per-user accent by default).
export default function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-surface-2 font-medium text-fg-secondary',
        sizeMap[size],
        className
      )}
    >
      {src ? (
        <AvatarPrimitive.Image
          src={src}
          alt={name ?? ''}
          className="size-full object-cover"
        />
      ) : null}
      <AvatarPrimitive.Fallback className="flex size-full items-center justify-center">
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
