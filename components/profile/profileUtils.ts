import type {ProfileData} from '@/components/profile/types';

export const normalizeProfile = (input: Record<string, unknown>): ProfileData => ({
  username: String(input.username ?? ''),
  email: String(input.email ?? ''),
  full_name: String(input.full_name ?? input.fullname ?? ''),
  is_active: Boolean(input.is_active),
  email_verified: Boolean(input.email_verified)
});

export const getProfileInitials = (fullName: string, username: string) => {
  const source = fullName.trim() || username.trim();

  if (!source) {
    return 'W';
  }

  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return initials || source.slice(0, 2).toUpperCase();
};
