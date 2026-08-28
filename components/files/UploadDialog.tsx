'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import FieldError from '@/components/ui/FieldError';
import FileDropzone from '@/components/files/FileDropzone';
import UploadProgressBar from '@/components/files/UploadProgressBar';
import { startUpload, completeUpload } from '@/lib/api/files';
import { uploadFileSchema, ALLOWED_MIME_TYPES } from '@/lib/validation/files';
import { filenameSchema } from '@/lib/validation/schemas';
import { translateFileApiError } from '@/lib/i18n/files';

export interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  mode: 'private' | 'group';
  groupId?: string;
  onUploaded: () => void;
}

const filenameFormSchema = z.object({ filename: filenameSchema });
type FilenameFormValues = z.infer<typeof filenameFormSchema>;

/**
 * Uploads a file directly to a presigned POST URL with a native XHR so upload progress
 * (`xhr.upload.onprogress`) is available. Every `presigned_post_fields` entry is added to the
 * FormData first, and the actual `file` field is appended LAST — this ordering matters for
 * S3-style presigned POST policies.
 */
function uploadToPresignedUrl(
  url: string,
  fields: Record<string, string>,
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      formData.append(key, value);
    });
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress((event.loaded / event.total) * 100);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`presigned_post_failed_${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('presigned_post_network_error'));

    xhr.send(formData);
  });
}

export default function UploadDialog({ open, onClose, mode, groupId, onUploaded }: UploadDialogProps) {
  const t = useTranslations('files');
  const tv = useTranslations('validation');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FilenameFormValues>({
    resolver: zodResolver(filenameFormSchema),
    defaultValues: { filename: '' },
  });

  // Reset all local state whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setSelectedFile(null);
      setFileError(null);
      setProgress(0);
      setIsUploading(false);
      reset({ filename: '' });
    }
  }, [open, reset]);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setFileError(null);
    setValue('filename', file.name, { shouldValidate: true });
  };

  const handleClose = () => {
    if (isUploading) return;
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!selectedFile) {
      setFileError(tv('required'));
      return;
    }

    const parsed = uploadFileSchema.safeParse({ filename: values.filename, file: selectedFile });
    if (!parsed.success) {
      let hasFieldError = false;
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        if (path === 'file') {
          setFileError(tv(issue.message as never));
          hasFieldError = true;
        } else if (path === 'filename') {
          setError('filename', { message: tv(issue.message as never) });
          hasFieldError = true;
        }
      }
      if (hasFieldError) return;
    }
    setFileError(null);

    setIsUploading(true);
    setProgress(0);
    try {
      const startResponse = await startUpload({
        filename: values.filename,
        mime_type: selectedFile.type,
        scope: mode,
        group_id: mode === 'group' ? groupId : undefined,
      });
      const { upload_id, presigned_post_url, presigned_post_fields, file_id } = startResponse.data;

      await uploadToPresignedUrl(presigned_post_url, presigned_post_fields, selectedFile, setProgress);

      await completeUpload({
        upload_id,
        file_id,
        original_name: values.filename,
      });

      toast.success(t('toasts.uploadSuccess'));
      onUploaded();
      onClose();
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    } finally {
      setIsUploading(false);
    }
  });

  return (
    <Modal open={open} title={t('upload.title')} onClose={handleClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FileDropzone accept={ALLOWED_MIME_TYPES.join(',')} onFileSelect={handleFileSelect}>
          {selectedFile ? (
            <span className="font-medium text-[var(--text-primary)]">{selectedFile.name}</span>
          ) : (
            <span>{t('upload.dropzoneLabel')}</span>
          )}
        </FileDropzone>
        {fileError && <FieldError messages={fileError} />}

        <div>
          <label htmlFor="upload-filename" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            {t('upload.filenameLabel')}
          </label>
          <input
            id="upload-filename"
            {...register('filename')}
            disabled={isUploading}
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-all duration-150 focus-visible:border-border-focus focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-50"
          />
          <FieldError messages={errors.filename?.message} />
        </div>

        {isUploading && <UploadProgressBar value={progress} label={t('upload.uploading')} />}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isUploading}>
            {t('upload.cancel')}
          </Button>
          <Button type="submit" variant="primary" loading={isUploading} disabled={!selectedFile}>
            {t('upload.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
