'use client';

import FilesFeed from '@/components/files/FilesFeed';
import FilesShell from '@/components/files/FilesShell';

export default function FilesPage() {
  return (
    <FilesShell>
      <FilesFeed mode="private" basePath="/files" />
    </FilesShell>
  );
}
