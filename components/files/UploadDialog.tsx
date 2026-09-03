'use client';

import { ChangeEvent, useRef } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import FileDropzone from '@/components/files/FileDropzone';
import UploadItemRow from '@/components/files/UploadItemRow';
import type { UploadItem } from '@/hooks/useUploadQueue';
import { uploadFileSchema, ALLOWED_MIME_TYPES } from '@/lib/validation/files';
import { sanitizeFilename } from '@/lib/utils/formatFiles';

export interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * The lifted `useUploadQueue()` instance (owned by FilesFeed) this dialog
   * hands selected files to, and whose progress it renders inline — so
   * selecting a file gives immediate feedback in the same modal instead of
   * appearing to do nothing. The same `items` are also fed to the floating
   * `<UploadProgressPanel>` at the FilesFeed level, which keeps tracking
   * them after this dialog closes.
   */
  enqueue: (files: File[]) => void;
  items: UploadItem[];
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

/**
 * Runs the same non-blocking client-side validation (spec §12) that both
 * entry points capable of enqueuing files need: this dialog's dropzone/
 * browse inputs, and FilesFeed's drag&drop handler. Validation failures
 * never prevent the file from being enqueued — they only surface feedback
 * (a filename sanitize suggestion, or the translated validation message)
 * via the two callbacks, which each call site wires to its own `toast`/
 * translator calls. Kept deliberately decoupled from next-intl's translator
 * types here (both callers' `t`/`tv` instances are namespace-narrowed and
 * don't share a common function type) — this function only does the
 * validation loop + enqueue, the i18n/toast side effects stay at the call
 * site. Any file that still fails server-side lands in the queue's
 * per-item `error` state, which the floating panel already supports
 * retrying.
 */
export function validateAndEnqueueFiles(
  files: File[],
  enqueue: (files: File[]) => void,
  onSanitizeSuggestion: (suggestion: string) => void,
  onValidationError: (issueMessage: string) => void
): void {
  if (files.length === 0) return;
  for (const file of files) {
    const parsed = uploadFileSchema.safeParse({ filename: file.name, file });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (issue?.path[0] === 'filename') {
        onSanitizeSuggestion(sanitizeFilename(file.name));
      } else if (issue) {
        onValidationError(issue.message);
      }
    }
  }
  enqueue(files);
}

export default function UploadDialog({ open, onClose, enqueue, items, onRetry, onRemove }: UploadDialogProps) {
  const t = useTranslations('files');
  const tv = useTranslations('validation');
  const multiInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = (files: File[]) =>
    validateAndEnqueueFiles(
      files,
      enqueue,
      (suggestion) => toast(t('nameDialog.sanitizeSuggestion', { suggestion })),
      (issueMessage) => toast.error(tv(issueMessage as never))
    );

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

        {items.length > 0 && (
          <div className="space-y-2 border-t border-[var(--border-subtle)] pt-3">
            {items.map((item) => (
              <UploadItemRow key={item.id} item={item} onRetry={onRetry} onRemove={onRemove} />
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('upload.cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
