'use client';

import { ChangeEvent, useRef } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import FileDropzone from '@/components/files/FileDropzone';
import { uploadFileSchema, ALLOWED_MIME_TYPES } from '@/lib/validation/files';
import { sanitizeFilename } from '@/lib/utils/formatFiles';

export interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  mode: 'private' | 'group';
  groupId?: string;
  folderId?: string | null;
  /**
   * Kept for interface compatibility with existing call sites. The actual
   * "run once all queued uploads have settled" behavior now lives on the
   * `useUploadQueue({ onAllSettled })` instance owned by the parent
   * (FilesFeed) — that instance is typically wired with the very same
   * callback this prop receives, so the net effect (refetch once all queued
   * uploads settle, not immediately on file selection) is preserved even
   * though this component no longer invokes it directly.
   */
  onUploaded: () => void;
  /**
   * The one piece of the lifted `useUploadQueue()` instance (owned by
   * FilesFeed) this dialog actually needs — to hand off files selected via
   * the dropzone or the multi-file browse input. `items`/`retry`/
   * `removeSettled` are deliberately NOT part of this props type: the
   * floating `<UploadProgressPanel>` that consumes them is rendered once at
   * the FilesFeed level, not by this component (see FilesFeed.tsx), so this
   * dialog has no use for them.
   */
  enqueue: (files: File[]) => void;
}

export default function UploadDialog({ open, onClose, enqueue }: UploadDialogProps) {
  const t = useTranslations('files');
  const tv = useTranslations('validation');
  const multiInputRef = useRef<HTMLInputElement>(null);

  // Non-blocking per spec §12: validation failures never prevent the file from
  // being enqueued — they only surface a toast (a sanitize suggestion for
  // filename issues, the translated validation message otherwise). Any file
  // that still fails on the server will land in the queue's per-item `error`
  // state, which the floating panel already supports retrying.
  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0) return;
    for (const file of files) {
      const parsed = uploadFileSchema.safeParse({ filename: file.name, file });
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        if (issue?.path[0] === 'filename') {
          const suggestion = sanitizeFilename(file.name);
          toast(t('nameDialog.sanitizeSuggestion', { suggestion }));
        } else if (issue) {
          toast.error(tv(issue.message as never));
        }
      }
    }
    enqueue(files);
  };

  const handleMultiInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    handleFilesSelected(files);
    // Reset so selecting the same file(s) again still fires a change event.
    event.target.value = '';
  };

  return (
    <Modal open={open} title={t('upload.title')} onClose={onClose}>
      <div className="space-y-4">
        <FileDropzone accept={ALLOWED_MIME_TYPES.join(',')} onFileSelect={(file) => handleFilesSelected([file])}>
          <span>{t('upload.dropzoneLabel')}</span>
        </FileDropzone>

        <input
          ref={multiInputRef}
          type="file"
          multiple
          accept={ALLOWED_MIME_TYPES.join(',')}
          onChange={handleMultiInputChange}
          className="hidden"
        />
        <Button type="button" variant="secondary" onClick={() => multiInputRef.current?.click()}>
          {t('upload.selectFile')}
        </Button>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('upload.cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
