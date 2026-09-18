type MinimalTranslator = ((key: string, values?: Record<string, unknown>) => string) & {
  has: (key: string) => boolean;
};

/**
 * `t` is expected to already be scoped to the `group_minutes` namespace
 * (e.g. `useTranslations('group_minutes')`), mirroring lib/i18n/tasks.ts's
 * `TaskTranslations` convention — keys below are relative, not prefixed.
 */
export function translateMinutesStatus(t: MinimalTranslator, status: string): string {
  const key = `status_enum.${status}`;
  return t.has(key) ? t(key) : status;
}

export function translateParticipantRole(t: MinimalTranslator, role: string): string {
  const key = `role_enum.${role}`;
  return t.has(key) ? t(key) : role;
}

export function translateMinutesApiError(t: MinimalTranslator, error: unknown, fallbackKey: string): string {
  const status = (error as {response?: {status?: number}} | undefined)?.response?.status;
  const key = status ? `errors.api.${status}` : null;
  if (key && t.has(key)) {
    return t(key);
  }
  return t(fallbackKey);
}
