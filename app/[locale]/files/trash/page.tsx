'use client';

import TrashView from '@/components/files/TrashView';
import FilesShell from '@/components/files/FilesShell';

export default function FilesTrashPage() {
  return (
    <FilesShell>
      <TrashView />
    </FilesShell>
  );
}
