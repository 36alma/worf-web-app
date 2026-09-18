import {useTranslations} from 'next-intl';

export type MinutesTranslations = ReturnType<typeof useTranslations<'group_minutes'>>;

/**
 * `t` is expected to already be scoped to the `group_minutes` namespace
 * (e.g. `useTranslations('group_minutes')`), mirroring lib/i18n/tasks.ts's
 * `TaskTranslations` convention — keys below are relative, not prefixed.
 */
export function translateMinutesStatus(t: MinutesTranslations, status: string): string {
  const key = `status_enum.${status}`;
  return t.has(key as any) ? t(key as any) : status;
}

export function translateParticipantRole(t: MinutesTranslations, role: string): string {
  const key = `role_enum.${role}`;
  return t.has(key as any) ? t(key as any) : role;
}

export function translateMinutesApiError(t: MinutesTranslations, error: unknown, fallbackKey: Parameters<MinutesTranslations>[0]): string {
  const status = (error as {response?: {status?: number}} | undefined)?.response?.status;
  const key = status ? `errors.api.${status}` : null;
  if (key && t.has(key as any)) {
    return t(key as any);
  }
  return t(fallbackKey);
}
