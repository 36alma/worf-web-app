'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import FileDetailSheet from '@/components/files/FileDetailSheet';
import NameDialog from '@/components/files/NameDialog';
import PreviewModal from '@/components/files/PreviewModal';
import UploadDialog from '@/components/files/UploadDialog';
import type {FileEntry} from '@/components/files/entryTypes';
import {useUploadQueue, type UploadItem} from '@/hooks/useUploadQueue';
import {getFileMetadata, renameFile, type FileMetadataResponse} from '@/lib/api/files';
import {translateFileApiError} from '@/lib/i18n/files';
import type {ChipRef} from '../entities';
import {useOpenErrorToast, type EntityHostProps} from './shared';

const toChips = (items: UploadItem[]): ChipRef[] =>
  items
    .filter((item) => item.status === 'done' && item.fileId)
    .map((item) => ({type: 'file' as const, id: item.fileId as string, label: item.file.name}));

/** The Files page's own dialogs: `UploadDialog` to upload, `NameDialog` to rename, `FileDetailSheet` (+ `PreviewModal`) to open a chip. */
export default function FileEntityModals(props: EntityHostProps) {
  const {ctx, request, onDone} = props;
  if (request.mode === 'create') return <FileUpload groupId={ctx.groupId} onDone={onDone} />;
  if (request.mode === 'modify') return <FileRename fileId={request.item.id} name={request.item.label} onDone={onDone} />;
  return <FileView fileId={request.ref.id} onDone={onDone} />;
}

function FileUpload({groupId, onDone}: {groupId: string; onDone: EntityHostProps['onDone']}) {
  const queue = useUploadQueue({mode: 'group', groupId});
  const {items} = queue;

  // Uploaded files become chips as soon as the whole batch is done; a failed one stays for a retry.
  useEffect(() => {
    if (items.length > 0 && items.every((item) => item.status === 'done')) onDone(toChips(items));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return (
    <UploadDialog
      open
      onClose={() => onDone(toChips(items))}
      enqueue={queue.enqueue}
      items={items}
      onRetry={queue.retry}
      onRemove={queue.removeSettled}
    />
  );
}

function FileRename({fileId, name, onDone}: {fileId: string; name: string; onDone: EntityHostProps['onDone']}) {
  const t = useTranslations('files');
  return (
    <NameDialog
      open
      title={t('rename.fileTitle')}
      label={t('rename.label')}
      initialValue={name}
      submitLabel={t('rename.submit')}
      onSubmit={async (next) => {
        try {
          await renameFile(fileId, next);
          toast.success(t('toasts.renameSuccess'));
        } catch (error) {
          toast.error(translateFileApiError(t, error, 'errors.default'));
          throw error; // keeps the dialog open, like the detail sheet's rename
        }
      }}
      onClose={() => onDone()}
    />
  );
}

function FileView({fileId, onDone}: {fileId: string; onDone: EntityHostProps['onDone']}) {
  const reportOpenError = useOpenErrorToast();
  const [metadata, setMetadata] = useState<FileMetadataResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // Resolve the file first so a deleted/forbidden one gets the "no longer exists" toast instead of an empty sheet.
  useEffect(() => {
    let mounted = true;
    getFileMetadata(fileId)
      .then(({data}) => mounted && setMetadata(data))
      .catch((error) => {
        if (!mounted) return;
        reportOpenError(error);
        onDone();
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  if (!metadata) return null;

  const entry: FileEntry = {
    kind: 'file',
    id: metadata.file_id,
    original_name: metadata.original_name,
    mime_type: metadata.mime_type,
    size_bytes: metadata.size_bytes,
    scope: metadata.scope,
    uploaded_at: metadata.uploaded_at,
    is_owner: metadata.is_owner,
    folder_id: metadata.folder_id,
    is_starred: metadata.is_starred
  };

  return (
    <>
      <FileDetailSheet
        fileId={fileId}
        onClose={() => onDone()}
        onDeleted={() => onDone()}
        onPreview={() => setPreviewing(true)}
      />
      <PreviewModal
        files={[entry]}
        currentFileId={previewing ? fileId : null}
        onNavigate={() => undefined}
        onClose={() => setPreviewing(false)}
        onOpenDetails={() => setPreviewing(false)}
      />
    </>
  );
}
