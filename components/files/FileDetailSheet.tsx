'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import * as Tabs from '@radix-ui/react-tabs';
import clsx from 'clsx';
import { FileText } from 'lucide-react';
import SideSheet from '@/components/ui/SideSheet';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Button from '@/components/ui/Button';
import {
  getFileMetadata,
  requestDownload,
  buildDownloadUrl,
  deleteFile,
  type FileMetadataResponse,
} from '@/lib/api/files';
import { translateFileApiError } from '@/lib/i18n/files';
import { formatFileSize, formatMimeType, formatUploadedAt } from '@/lib/utils/formatFiles';

export interface FileDetailSheetProps {
  fileId: string | null;
  onClose: () => void;
  onDeleted?: () => void;
}

const DOWNLOAD_DEBOUNCE_MS = 2000;

export default function FileDetailSheet({ fileId, onClose, onDeleted }: FileDetailSheetProps) {
  const t = useTranslations('files');

  const [activeTab, setActiveTab] = useState('metadata');
  const [metadata, setMetadata] = useState<FileMetadataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  useEffect(() => {
    if (fileId === null) {
      setMetadata(null);
      return;
    }

    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      try {
        const response = await getFileMetadata(fileId);
        if (!mounted) return;
        setMetadata(response.data);
      } catch (error) {
        if (!mounted) return;
        toast.error(translateFileApiError(t, error, 'errors.default'));
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [fileId, t]);

  const handleDownload = async () => {
    if (fileId === null || isRequesting) return;
    setIsRequesting(true);
    try {
      const response = await requestDownload(fileId);
      window.location.href = buildDownloadUrl(response.data.download_token);
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    } finally {
      setTimeout(() => setIsRequesting(false), DOWNLOAD_DEBOUNCE_MS);
    }
  };

  const handleDeleteConfirm = async () => {
    if (fileId === null) return;
    setIsDeleting(true);
    try {
      await deleteFile(fileId);
      toast.success(t('toasts.deleteSuccess'));
      setIsConfirmOpen(false);
      onClose();
      onDeleted?.();
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <SideSheet open={fileId !== null} title={t('detail.title')} onClose={onClose}>
        <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex h-full w-full flex-col">
          <Tabs.List className="mb-6 mt-[-10px] flex border-b border-[var(--border-subtle)]">
            <Tabs.Trigger
              value="metadata"
              className={clsx(
                'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold outline-none transition-all',
                activeTab === 'metadata'
                  ? 'border-orange-500 text-orange-500'
                  : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              )}
            >
              <FileText size={16} /> {t('detail.tabs.metadata')}
            </Tabs.Trigger>
            {/* Task 6 (share) and Task 7 (audit) add their Tabs.Trigger/Tabs.Content pairs here. */}
          </Tabs.List>

          <Tabs.Content value="metadata" className="flex flex-col gap-4 outline-none">
            {isLoading || !metadata ? (
              <div className="space-y-2">
                <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
                <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
                <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
              </div>
            ) : (
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{t('detail.fields.name')}</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">{metadata.original_name}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{t('detail.fields.type')}</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">
                    {formatMimeType(metadata.mime_type)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{t('detail.fields.size')}</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">
                    {formatFileSize(metadata.size_bytes)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{t('detail.fields.uploadedAt')}</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">
                    {formatUploadedAt(metadata.uploaded_at)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{t('detail.fields.scope')}</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">
                    {metadata.scope === 'group' ? t('detail.scopeValues.group') : t('detail.scopeValues.private')}
                  </dd>
                </div>
              </dl>
            )}

            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="primary"
                onClick={handleDownload}
                disabled={fileId === null || isRequesting}
              >
                {t('detail.download')}
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => setIsConfirmOpen(true)}
                disabled={fileId === null || isLoading}
              >
                {t('detail.delete')}
              </Button>
            </div>
          </Tabs.Content>
        </Tabs.Root>
      </SideSheet>

      <ConfirmDialog
        open={isConfirmOpen}
        title={t('detail.confirmDelete.title')}
        message={t('detail.confirmDelete.message')}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          if (!isDeleting) {
            void handleDeleteConfirm();
          }
        }}
      />
    </>
  );
}
