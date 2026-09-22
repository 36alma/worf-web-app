/**
 * Batches refresh requests into one flush per window.
 *
 * The window opens on the first request and is NOT extended by later ones (a fixed window, not a sliding debounce),
 * so a burst of saves cannot starve the refresh. Repeated keys inside a window collapse into one.
 */
export interface Coalescer<K> {
  request: (...keys: K[]) => void;
  cancel: () => void;
}

export function createCoalescer<K>(flush: (keys: K[]) => void, delayMs: number): Coalescer<K> {
  const pending = new Set<K>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    request(...keys) {
      keys.forEach((key) => pending.add(key));
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        const batch = [...pending];
        pending.clear();
        flush(batch);
      }, delayMs);
    },
    cancel() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending.clear();
    }
  };
}
