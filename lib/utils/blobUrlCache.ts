/**
 * Ref-counted `URL.createObjectURL` cache keyed by an arbitrary string
 * (this project uses the thumbnail/preview endpoint path as the key).
 * Multiple `ThumbnailImage` instances that happen to render the same file
 * at the same time share one object URL and only revoke it once nothing
 * references it anymore, avoiding flicker from premature revocation.
 */
interface Entry {
  url: string;
  refCount: number;
}

const cache = new Map<string, Entry>();

export function acquireBlobUrl(key: string, blob: Blob): string {
  const existing = cache.get(key);
  if (existing) {
    existing.refCount += 1;
    return existing.url;
  }
  const url = URL.createObjectURL(blob);
  cache.set(key, {url, refCount: 1});
  return url;
}

export function releaseBlobUrl(key: string): void {
  const existing = cache.get(key);
  if (!existing) return;
  existing.refCount -= 1;
  if (existing.refCount <= 0) {
    URL.revokeObjectURL(existing.url);
    cache.delete(key);
  }
}
