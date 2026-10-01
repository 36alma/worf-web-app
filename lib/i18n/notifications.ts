import {useTranslations} from 'next-intl';

export type NotificationsTranslations = ReturnType<typeof useTranslations<'notifications'>>;

export function translateNotificationCategory(t: NotificationsTranslations, category: string) {
  return t.has(`category_enum.${category}` as any) ? t(`category_enum.${category}` as any) : category;
}

export function translateInboxActionStatus(t: NotificationsTranslations, status: string) {
  return t.has(`action_status_enum.${status}` as any) ? t(`action_status_enum.${status}` as any) : status;
}

export function translateNotificationApiError(
  t: NotificationsTranslations,
  error: unknown,
  fallbackKey: Parameters<NotificationsTranslations>[0]
) {
  const status = (error as {response?: {status?: number}} | undefined)?.response?.status;
  if (status && t.has(`errors.api.${status}` as any)) {
    return t(`errors.api.${status}` as any);
  }

  return t(fallbackKey);
}
