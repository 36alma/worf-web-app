'use client';

import { useEffect, useRef, useState } from 'react';
import { getPreviewUrl, getThumbnailUrl } from '@/lib/api/files';
import { acquireBlobUrl, releaseBlobUrl } from '@/lib/utils/blobUrlCache';
import FileTypeIcon from './FileTypeIcon';

export interface ThumbnailImageProps {
  fileId: string;
  mimeType: string | null;
  variant?: 'thumbnail' | 'preview';
  alt: string;
  className?: string;
}

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 60_000;

type LoadState = 'loading' | 'ready' | 'failed';

export default function ThumbnailImage({ fileId, mimeType, variant = 'thumbnail', alt, className }: ThumbnailImageProps) {
  const [state, setState] = useState<LoadState>('loading');
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const cacheKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const url = variant === 'preview' ? getPreviewUrl(fileId) : getThumbnailUrl(fileId);
    const startedAt = Date.now();

    setState('loading');
    setObjectUrl(null);

    const poll = async () => {
      try {
        const response = await fetch(url);
        if (cancelled) return;

        if (response.status === 200) {
          const blob = await response.blob();
          if (cancelled) return;
          const objUrl = acquireBlobUrl(url, blob);
          cacheKeyRef.current = url;
          setObjectUrl(objUrl);
          setState('ready');
          return;
        }

        if (response.status === 202) {
          const body = (await response.json()) as {status: 'pending' | 'failed'};
          if (body.status === 'failed' || Date.now() - startedAt > POLL_TIMEOUT_MS) {
            setState('failed');
            return;
          }
          timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }

        setState('failed');
      } catch {
        if (!cancelled) setState('failed');
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (cacheKeyRef.current) {
        releaseBlobUrl(cacheKeyRef.current);
        cacheKeyRef.current = null;
      }
    };
  }, [fileId, variant]);

  if (state === 'ready' && objectUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- authenticated blob: URL, next/image can't proxy this
    return <img src={objectUrl} alt={alt} className={className ?? 'h-full w-full object-cover'} />;
  }

  if (state === 'loading') {
    return <div className={className ?? 'h-full w-full animate-pulse bg-[var(--bg-elevated)]'} />;
  }

  return (
    <div className={className ?? 'flex h-full w-full items-center justify-center'}>
      <FileTypeIcon mimeType={mimeType} />
    </div>
  );
}
