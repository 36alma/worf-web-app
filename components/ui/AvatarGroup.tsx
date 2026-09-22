import Avatar from './Avatar';
import { cn } from '@/lib/utils/cn';

export interface AvatarGroupUser {
  name?: string | null;
  src?: string | null;
}

export interface AvatarGroupProps {
  users: AvatarGroupUser[];
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Stacked avatars with a "+N" overflow badge — purely visual (spec: no click-to-filter yet).
export default function AvatarGroup({ users, max = 5, size = 'sm', className }: AvatarGroupProps) {
  const visible = users.slice(0, max);
  const overflow = users.length - visible.length;

  if (users.length === 0) return null;

  return (
    <div className={cn('flex items-center -space-x-2', className)}>
      {visible.map((user, index) => (
        <Avatar
          key={`${user.name ?? 'user'}-${index}`}
          name={user.name}
          src={user.src}
          size={size}
          className="ring-2 ring-surface-1"
        />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            'inline-flex shrink-0 select-none items-center justify-center rounded-full bg-surface-2 font-medium text-fg-secondary ring-2 ring-surface-1',
            size === 'sm' ? 'size-6 text-[10px]' : size === 'lg' ? 'size-10 text-sm' : 'size-8 text-caption'
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
