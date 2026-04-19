import {useTranslations} from 'next-intl';

export type TaskTranslations = ReturnType<typeof useTranslations<'tasks'>>;

export function translateTaskStatus(t: TaskTranslations, status: string) {
  return t.has(`status_enum.${status}`) ? t(`status_enum.${status}`) : status;
}

export function translateTaskType(t: TaskTranslations, taskType: string) {
  return t.has(`types.${taskType}`) ? t(`types.${taskType}`) : taskType;
}

export function translateTaskPriority(t: TaskTranslations, priority: string) {
  const normalized = priority.toUpperCase() === 'URGENT' ? 'CRITICAL' : priority.toUpperCase();
  return t.has(`priority_enum.${normalized}`) ? t(`priority_enum.${normalized}`) : priority;
}

export function translateTaskApiError(
  t: TaskTranslations,
  error: unknown,
  fallbackKey: Parameters<TaskTranslations>[0]
) {
  const status = (error as {response?: {status?: number}} | undefined)?.response?.status;
  if (status && t.has(`errors.api.${status}`)) {
    return t(`errors.api.${status}`);
  }

  return t(fallbackKey);
}
