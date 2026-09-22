import {useCallback} from 'react';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import type {ChipRef, EditorContext, PickerItem} from '../entities';

export type EntityModalRequest =
  | {mode: 'create'}
  | {mode: 'modify'; item: PickerItem}
  | {mode: 'view'; ref: ChipRef};

export interface EntityHostProps {
  ctx: EditorContext;
  request: EntityModalRequest;
  /** Ends the request. `chips` are the records a `create` produced — omit (or pass none) on cancel, modify and view. */
  onDone: (chips?: ChipRef[]) => void;
}

/** Toast for a record that could not be opened/loaded: 404 → gone, 403 → no access. Handles axios and fetch-style errors. */
export function useOpenErrorToast() {
  const t = useTranslations('group_minutes');
  return useCallback(
    (error: unknown) => {
      const e = error as {response?: {status?: number}; status?: number} | undefined;
      const status = e?.response?.status ?? e?.status;
      if (status === 404) toast.error(t('editor.flow.not_found'));
      else if (status === 403) toast.error(t('editor.flow.open_forbidden'));
      else toast.error(t('errors.default'));
    },
    [t]
  );
}
