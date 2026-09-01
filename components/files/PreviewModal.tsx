'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, Download, Info, Star, X } from 'lucide-react';
import { getFileMetadata, requestDownload, buildDownloadUrl, starFile, unstarFile, type FileMetadataResponse } from '@/lib/api/files';
import { translateFileApiError } from '@/lib/i18n/files';
import { formatFileSize, formatUploadedAt } from '@/lib/utils/formatFiles';
import FileTypeIcon from './FileTypeIcon';
import ThumbnailImage from './ThumbnailImage';
import type { FileEntry } from './entryTypes';

export interface PreviewModalProps {
  files: FileEntry[];
  currentFileId: string | null;
  onNavigate: (fileId: string) => void;
  onClose: () => void;
  onOpenDetails: (fileId: string) => void;
}

export default function PreviewModal({ files, currentFileId, onNavigate, onClose, onOpenDetails }: PreviewModalProps) {
  const t = useTranslations('files');
  const [metadata, setMetadata] = useState<FileMetadataResponse | null>(null);
  const touchStartX = useRef(0);

  const currentIndex = files.findIndex((f) => f.id === currentFileId);
  const currentEntry = currentIndex >= 0 ? files[currentIndex] : null;

  useEffect(() => {
    if (!currentFileId) {
      setMetadata(null);
      return;
    }
    let mounted = true;
    getFileMetadata(currentFileId)
      .then((response) => mounted && setMetadata(response.data))
      .catch(() => mounted && setMetadata(null));
    return () => {
      mounted = false;
    };
  }, [currentFileId]);

  const goPrev = () => currentIndex > 0 && onNavigate(files[currentIndex - 1].id);
  const goNext = () => currentIndex >= 0 && currentIndex < files.length - 1 && onNavigate(files[currentIndex + 1].id);

  useEffect(() => {
    if (!currentFileId) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') goPrev();
      if (event.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFileId, currentIndex, files]);

  if (!currentFileId || !currentEntry) return null;

  const isImage = currentEntry.mime_type?.startsWith('image/') ?? false;

  const handleDownload = async () => {
    try {
      const response = await requestDownload(currentEntry.id);
      window.location.href = buildDownloadUrl(response.data.download_token);
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    }
  };

  const handleToggleStar = async () => {
    try {
      if (metadata?.is_starred) await unstarFile(currentEntry.id);
      else await starFile(currentEntry.id);
      const refreshed = await getFileMetadata(currentEntry.id);
      setMetadata(refreshed.data);
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    }
  };

  return (
    <Dialog.Root open={!!currentFileId} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Content
          className="fixed inset-0 z-[100] flex flex-col bg-black/90 focus:outline-none"
          onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX; }}
          onTouchEnd={(event) => {
            const delta = event.changedTouches[0].clientX - touchStartX.current;
            if (delta > 60) goPrev();
            else if (delta < -60) goNext();
          }}
        >
          <Dialog.Title className="sr-only">{currentEntry.original_name}</Dialog.Title>
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{currentEntry.original_name}</p>
              {metadata && (
                <p className="text-xs text-white/60">{formatFileSize(metadata.size_bytes)} · {formatUploadedAt(metadata.uploaded_at)}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={handleToggleStar} aria-label={t('table.star')} className="rounded-full p-2 hover:bg-white/10">
                <Star size={18} strokeWidth={1.75} className={metadata?.is_starred ? 'fill-[var(--accent)] text-[var(--accent)]' : 'text-white'} />
              </button>
              <button type="button" onClick={() => onOpenDetails(currentEntry.id)} aria-label={t('preview.details')} className="rounded-full p-2 hover:bg-white/10">
                <Info size={18} strokeWidth={1.75} className="text-white" />
              </button>
              <button type="button" onClick={handleDownload} aria-label={t('detail.download')} className="rounded-full p-2 hover:bg-white/10">
                <Download size={18} strokeWidth={1.75} className="text-white" />
              </button>
              <button type="button" onClick={onClose} aria-label={t('preview.close')} className="rounded-full p-2 hover:bg-white/10">
                <X size={20} strokeWidth={1.75} className="text-white" />
              </button>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
            {currentIndex > 0 && (
              <button type="button" onClick={goPrev} aria-label={t('preview.prev')} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 sm:left-4">
                <ChevronLeft size={22} strokeWidth={2} />
              </button>
            )}
            {isImage ? (
              <ThumbnailImage
                fileId={currentEntry.id}
                mimeType={currentEntry.mime_type}
                variant="preview"
                alt={currentEntry.original_name}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-white">
                <FileTypeIcon mimeType={currentEntry.mime_type} size={64} className="text-white/70" />
                <p className="text-sm text-white/70">{t('preview.noPreview')}</p>
                <button type="button" onClick={handleDownload} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
                  {t('detail.download')}
                </button>
              </div>
            )}
            {currentIndex >= 0 && currentIndex < files.length - 1 && (
              <button type="button" onClick={goNext} aria-label={t('preview.next')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 sm:right-4">
                <ChevronRight size={22} strokeWidth={2} />
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
