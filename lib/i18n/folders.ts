import {useTranslations} from 'next-intl';
import {translateApiError} from './apiError';

export type FoldersTranslations = ReturnType<typeof useTranslations<'folders'>>;

export function translateFolderApiError(
  t: FoldersTranslations,
  error: unknown,
  fallbackKey: Parameters<FoldersTranslations>[0]
) {
  return translateApiError(t as unknown as Parameters<typeof translateApiError>[0], error, fallbackKey as string);
}
