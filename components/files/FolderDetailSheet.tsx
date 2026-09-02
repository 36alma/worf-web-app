'use client';

import SideSheet from '@/components/ui/SideSheet';

export interface FolderDetailSheetProps {
  folderId: string | null;
  onClose: () => void;
  onDeleted?: () => void;
  onRenamed?: () => void;
  readOnly?: boolean;
}

// Placeholder — Task 32 replaces this body with metadata/share/audit tabs.
export default function FolderDetailSheet({ folderId, onClose }: FolderDetailSheetProps) {
  if (folderId === null) return null;
  return (
    <SideSheet open title="" onClose={onClose}>
      <p className="text-sm text-[var(--text-tertiary)]">{folderId}</p>
    </SideSheet>
  );
}
