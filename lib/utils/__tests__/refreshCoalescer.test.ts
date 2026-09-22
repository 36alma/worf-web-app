import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createCoalescer} from '../refreshCoalescer';

describe('createCoalescer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('flushes once per window, with duplicates collapsed', () => {
    const flush = vi.fn();
    const c = createCoalescer<string>(flush, 1000);

    c.request('tasks', 'summary');
    c.request('summary', 'activity');
    expect(flush).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush.mock.calls[0][0].sort()).toEqual(['activity', 'summary', 'tasks']);
  });

  it('does not extend the window when more requests arrive (no starvation)', () => {
    const flush = vi.fn();
    const c = createCoalescer<string>(flush, 1000);

    c.request('tasks');
    vi.advanceTimersByTime(900);
    c.request('events');
    vi.advanceTimersByTime(100);

    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush.mock.calls[0][0].sort()).toEqual(['events', 'tasks']);
  });

  it('opens a fresh window after a flush', () => {
    const flush = vi.fn();
    const c = createCoalescer<string>(flush, 1000);

    c.request('tasks');
    vi.advanceTimersByTime(1000);
    c.request('tasks');
    vi.advanceTimersByTime(1000);

    expect(flush).toHaveBeenCalledTimes(2);
    expect(flush).toHaveBeenLastCalledWith(['tasks']);
  });

  it('cancel drops what is queued', () => {
    const flush = vi.fn();
    const c = createCoalescer<string>(flush, 1000);

    c.request('tasks');
    c.cancel();
    vi.advanceTimersByTime(5000);

    expect(flush).not.toHaveBeenCalled();
  });
});
