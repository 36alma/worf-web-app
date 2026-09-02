'use client';

import FilesShell from '@/components/files/FilesShell';
import SharedWithMeView from '@/components/files/SharedWithMeView';

export default function FilesSharedWithMePage() {
  return (
    <FilesShell>
      <SharedWithMeView />
    </FilesShell>
  );
}
