import {useTranslations} from 'next-intl';

export type FilesTranslations = ReturnType<typeof useTranslations<'files'>>;

export function translateFileApiError(
  t: FilesTranslations,
  error: unknown,
  fallbackKey: Parameters<FilesTranslations>[0]
) {
  const status = (error as {response?: {status?: number}} | undefined)?.response?.status;
  if (status && t.has(`errors.api.${status}` as any)) {
    return t(`errors.api.${status}` as any);
  }
  return t(fallbackKey);
}
