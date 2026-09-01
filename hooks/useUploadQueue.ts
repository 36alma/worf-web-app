'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { startUpload, completeUpload, type FileScope } from '@/lib/api/files';

export type UploadItemStatus = 'queued' | 'uploading' | 'done' | 'error';

export interface UploadItem {
  id: string;
  file: File;
  status: UploadItemStatus;
  progress: number;
  errorMessage?: string;
}

export interface UseUploadQueueOptions {
  mode: FileScope;
  groupId?: string;
  folderId?: string | null;
  concurrency?: number;
  onAllSettled?: () => void;
}

let idCounter = 0;
const nextId = () => `upload-${++idCounter}`;

async function uploadOne(file: File, options: UseUploadQueueOptions, onProgress: (percent: number) => void): Promise<void> {
  const startResponse = await startUpload({
    filename: file.name,
    mime_type: file.type,
    scope: options.mode,
    group_id: options.mode === 'group' ? options.groupId : undefined,
    folder_id: options.folderId,
  });
  const { upload_id, presigned_post_url, presigned_post_fields, file_id } = startResponse.data;

  const formData = new FormData();
  Object.entries(presigned_post_fields).forEach(([key, value]) => formData.append(key, value));
  formData.append('file', file);

  onProgress(10);
  const putResponse = await fetch(presigned_post_url, { method: 'POST', body: formData });
  if (!putResponse.ok) {
    throw new Error(`presigned_post_failed_${putResponse.status}`);
  }
  onProgress(90);

  await completeUpload({ upload_id, file_id, original_name: file.name });
  onProgress(100);
}

export function useUploadQueue(options: UseUploadQueueOptions) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const inFlightCount = useRef(0);
  const concurrency = options.concurrency ?? 3;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  // Guards against React 18 Strict Mode's intentional double-invocation of
  // functional `setState` updaters in development: `pump()`'s updater below
  // now ONLY computes a pure state transition (queued -> uploading) and never
  // starts any network I/O itself. The actual upload is kicked off exactly
  // once per item id, from the effect further down (which is not subject to
  // that double-invoke behavior), guarded by this ref — refs survive Strict
  // Mode's simulated double-invoke because it reuses the same component
  // instance/hook state, not a fresh one, so the guard persists across it.
  const startedRef = useRef<Set<string>>(new Set());

  const updateItem = (id: string, patch: Partial<UploadItem>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  // Pure state transition ONLY — no side effects. Flips up to `concurrency`
  // "queued" items to "uploading". Starting the actual upload for a
  // newly-"uploading" item is the effect's job, not this function's.
  const pump = useCallback(() => {
    setItems((current) => {
      const runningCount = current.filter((item) => item.status === 'uploading').length;
      let slotsAvailable = concurrency - runningCount;
      if (slotsAvailable <= 0) return current;

      const next = current.map((item) => {
        if (slotsAvailable <= 0 || item.status !== 'queued') return item;
        slotsAvailable -= 1;
        return { ...item, status: 'uploading' as const };
      });
      return next;
    });
  }, [concurrency]);

  const runUpload = async (id: string, file: File) => {
    try {
      await uploadOne(file, optionsRef.current, (percent) => updateItem(id, { progress: percent }));
      updateItem(id, { status: 'done', progress: 100 });
    } catch (error) {
      updateItem(id, { status: 'error', errorMessage: error instanceof Error ? error.message : 'upload_failed' });
    } finally {
      // Allow a later retry() of this same id to re-trigger a fresh
      // runUpload call instead of being permanently blocked by the guard.
      startedRef.current.delete(id);
      pump();
      setItems((current) => {
        if (current.every((item) => item.status === 'done' || item.status === 'error')) {
          optionsRef.current.onAllSettled?.();
        }
        return current;
      });
    }
  };

  // The ONLY place `runUpload` is ever invoked. Reacts to `items` changing
  // (in particular, to `pump()` flipping a "queued" item to "uploading") and
  // starts the upload for any "uploading" item that hasn't been started yet
  // per `startedRef`. Unlike the old in-updater call, this is not evaluated
  // as part of computing state, so Strict Mode's updater double-invocation
  // cannot cause it to fire twice for the same commit; `startedRef` is a
  // second, independent safety net in case the effect body itself ever runs
  // more than once for the same items snapshot.
  useEffect(() => {
    for (const item of items) {
      if (item.status === 'uploading' && !startedRef.current.has(item.id)) {
        startedRef.current.add(item.id);
        void runUpload(item.id, item.file);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const enqueue = useCallback(
    (files: File[]) => {
      const newItems: UploadItem[] = files.map((file) => ({ id: nextId(), file, status: 'queued', progress: 0 }));
      setItems((current) => [...current, ...newItems]);
      setTimeout(pump, 0);
    },
    [pump]
  );

  const retry = useCallback(
    (id: string) => {
      setItems((current) => current.map((item) => (item.id === id ? { ...item, status: 'queued', progress: 0, errorMessage: undefined } : item)));
      setTimeout(pump, 0);
    },
    [pump]
  );

  const removeSettled = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  return { items, enqueue, retry, removeSettled };
}
