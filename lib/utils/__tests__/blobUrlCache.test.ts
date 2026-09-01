import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {acquireBlobUrl, releaseBlobUrl} from '../blobUrlCache';

describe('blobUrlCache', () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    let counter = 0;
    createObjectURLSpy = vi.fn(() => `blob:mock-${++counter}`);
    revokeObjectURLSpy = vi.fn();
    // @ts-expect-error jsdom doesn't implement these
    global.URL.createObjectURL = createObjectURLSpy;
    // @ts-expect-error jsdom doesn't implement these
    global.URL.revokeObjectURL = revokeObjectURLSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates one object URL per key on first acquire', () => {
    const blob = new Blob(['a']);
    const url = acquireBlobUrl('file-1', blob);
    expect(url).toBe('blob:mock-1');
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    releaseBlobUrl('file-1');
  });

  it('reuses the same object URL for concurrent acquires of the same key', () => {
    const blob = new Blob(['a']);
    const first = acquireBlobUrl('file-2', blob);
    const second = acquireBlobUrl('file-2', blob);
    expect(second).toBe(first);
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    releaseBlobUrl('file-2');
    releaseBlobUrl('file-2');
  });

  it('only revokes once the ref count drops to zero', () => {
    const blob = new Blob(['a']);
    acquireBlobUrl('file-3', blob);
    acquireBlobUrl('file-3', blob);
    releaseBlobUrl('file-3');
    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
    releaseBlobUrl('file-3');
    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
  });

  it('is a no-op releasing a key that was never acquired', () => {
    expect(() => releaseBlobUrl('never-acquired')).not.toThrow();
    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
  });
});
