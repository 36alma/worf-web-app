import {useMemo} from 'react';
import {useLocale} from 'next-intl';
import type {EditorContext} from './entities';

/** Builds the shared editor context (group, locale, self-reference owner). */
export function useEditorContext(groupId: string, minutesId?: string): EditorContext {
  const locale = useLocale();
  return useMemo(
    () => ({groupId, locale, owner: minutesId ? {type: 'minutes' as const, id: minutesId} : undefined}),
    [groupId, locale, minutesId]
  );
}
