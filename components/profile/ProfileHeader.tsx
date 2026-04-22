'use client';

import Badge from '@/components/ui/Badge';
import {getProfileInitials} from '@/components/profile/profileUtils';
import type {ProfileData} from '@/components/profile/types';

interface ProfileHeaderProps {
  profile: ProfileData;
  title: string;
  activeLabel: string;
  inactiveLabel: string;
}

export default function ProfileHeader({
  profile,
  title,
  activeLabel,
  inactiveLabel
}: ProfileHeaderProps) {
  const isActive = profile.is_active || profile.email_verified;
  const initials = getProfileInitials(profile.full_name, profile.username);

  return (
    <section className="surface overflow-hidden rounded-[var(--radius-lg)]">
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(255,107,44,0.18),transparent_45%),linear-gradient(135deg,var(--bg-elevated),var(--bg-surface))] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-subtle)] text-lg font-semibold tracking-[0.16em] text-[var(--accent)]">
              {initials}
            </div>

            <div className="min-w-0 space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{title}</p>
              <h2 className="display-font truncate text-2xl text-[var(--text-primary)]">
                {profile.full_name || profile.username}
              </h2>
              <div className="flex flex-col gap-1 text-sm text-[var(--text-secondary)] md:flex-row md:flex-wrap md:items-center md:gap-3">
                <span>@{profile.username || 'user'}</span>
                <span className="hidden text-[var(--text-tertiary)] md:inline">•</span>
                <span className="truncate">{profile.email || '—'}</span>
              </div>
            </div>
          </div>

          <Badge color={isActive ? 'green' : 'red'}>
            {isActive ? activeLabel : inactiveLabel}
          </Badge>
        </div>
      </div>
    </section>
  );
}
