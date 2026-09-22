import {useCallback} from 'react';
import type {ChipRef} from './entities';
import {readChip} from './commandChipExtension';
import {useEntityModals} from './EntityModalProvider';

/**
 * Opens the record a chip points to in its own modal (task detail, event view, post view, …).
 * Shared by the editor (chip click) and the read-only renderer; a record that is gone or off-limits
 * is reported by the modal host (404 → "no longer exists", 403 → no access) and the chip stays.
 */
export function useChipOpener() {
  const modals = useEntityModals();
  const open = useCallback((ref: ChipRef) => modals.view(ref), [modals]);

  /** Click handler for read-only HTML (event delegation on `span[data-command-type]`). */
  const onContentClick = useCallback(
    (event: React.MouseEvent) => {
      const ref = readChip(event.target);
      if (!ref) return;
      event.preventDefault();
      open(ref);
    },
    [open]
  );

  return {open, onContentClick};
}
