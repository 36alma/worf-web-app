'use client';

import { useParams } from 'next/navigation';
import FilesFeed from '@/components/files/FilesFeed';
import FilesShell from '@/components/files/FilesShell';

export default function FilesFolderPage() {
  const params = useParams();
  const folderId = decodeURIComponent(String(params.folderId ?? ''));

  return (
    <FilesShell>
      <FilesFeed mode="private" folderId={folderId} basePath="/files" />
    </FilesShell>
  );
}
