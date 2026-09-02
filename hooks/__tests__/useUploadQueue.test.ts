// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useUploadQueue } from '../useUploadQueue';

vi.mock('@/lib/api/files', () => ({
  startUpload: vi.fn().mockResolvedValue({
    data: { upload_id: 'u1', presigned_post_url: 'https://example.test/put', presigned_post_fields: {}, file_id: 'f1', folder_id: null },
  }),
  completeUpload: vi.fn().mockResolvedValue({ data: { file_id: 'f1', original_name: 'a.txt', mime_type: 'text/plain', size_bytes: 3 } }),
}));

global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 });

function makeFile(name: string) {
  return new File(['abc'], name, { type: 'text/plain' });
}

describe('useUploadQueue', () => {
  it('enqueues files and eventually marks them done', async () => {
    const onAllSettled = vi.fn();
    const { result } = renderHook(() => useUploadQueue({ mode: 'private', onAllSettled }));

    act(() => {
      result.current.enqueue([makeFile('a.txt'), makeFile('b.txt')]);
    });

    expect(result.current.items).toHaveLength(2);

    await waitFor(() => expect(result.current.items.every((item) => item.status === 'done')).toBe(true));
    // Exactly once, not merely "at least once": onAllSettled/refetch() must
    // not double-fire. The settled-check that decides this now lives in a
    // plain ref counter decremented in runUpload's finally block, not inside
    // a setState updater — the earlier implementation's setItems((current)
    // => { ...; onAllSettled?.(); return current; }) pattern was vulnerable
    // to React 18 Strict Mode's intentional double-invocation of functional
    // updaters, which would have fired this twice per settle in dev.
    expect(onAllSettled).toHaveBeenCalledTimes(1);
  });

  it('does not fire onAllSettled again for a stale settle after retry() re-extends the batch', async () => {
    const onAllSettled = vi.fn();
    const { result } = renderHook(() => useUploadQueue({ mode: 'private', onAllSettled }));

    act(() => {
      result.current.enqueue([makeFile('a.txt')]);
    });

    await waitFor(() => expect(result.current.items.every((item) => item.status === 'done')).toBe(true));
    expect(onAllSettled).toHaveBeenCalledTimes(1);

    const id = result.current.items[0].id;
    act(() => {
      result.current.retry(id);
    });

    await waitFor(() => expect(result.current.items.every((item) => item.status === 'done')).toBe(true));
    expect(onAllSettled).toHaveBeenCalledTimes(2);
  });

  it('caps concurrent in-flight uploads at 3', async () => {
    const { result } = renderHook(() => useUploadQueue({ mode: 'private' }));
    act(() => {
      result.current.enqueue([1, 2, 3, 4, 5].map((n) => makeFile(`f${n}.txt`)));
    });
    const uploading = result.current.items.filter((item) => item.status === 'uploading');
    expect(uploading.length).toBeLessThanOrEqual(3);
  });
});
