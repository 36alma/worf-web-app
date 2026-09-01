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
    expect(onAllSettled).toHaveBeenCalled();
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
