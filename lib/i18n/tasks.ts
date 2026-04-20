import {useTranslations} from 'next-intl';

export type TaskTranslations = ReturnType<typeof useTranslations<'tasks'>>;

export function translateTaskStatus(t: TaskTranslations, status: string) {
  return t.has(`status_enum.${status}` as any) ? t(`status_enum.${status}` as any) : status;
}

export function translateTaskType(t: TaskTranslations, taskType: string) {
  return t.has(`types.${taskType}` as any) ? t(`types.${taskType}` as any) : taskType;
}

export function translateTaskPriority(t: TaskTranslations, priority: string) {
  const normalized = priority.toUpperCase() === 'URGENT' ? 'CRITICAL' : priority.toUpperCase();
  return t.has(`priority_enum.${normalized}` as any) ? t(`priority_enum.${normalized}` as any) : priority;
}

export function translateTaskApiError(
  t: TaskTranslations,
  error: unknown,
  fallbackKey: Parameters<TaskTranslations>[0]
) {
  const status = (error as {response?: {status?: number}} | undefined)?.response?.status;
  if (status && t.has(`errors.api.${status}` as any)) {
    return t(`errors.api.${status}` as any);
  }

  return t(fallbackKey);
}
