// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePagedDualList } from '../usePagedDualList';

describe('usePagedDualList', () => {
  it('loads the first page on mount', async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      listA: ['a1'], listB: ['b1', 'b2'], totalA: 1, totalB: 5, offset: 0, limit: 2,
    });
    const { result } = renderHook(() => usePagedDualList(fetchPage, 2, []));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.listA).toEqual(['a1']);
    expect(result.current.listB).toEqual(['b1', 'b2']);
    expect(fetchPage).toHaveBeenCalledWith(0, 2);
  });

  it('appends (does not replace) on loadMore', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ listA: ['a1'], listB: ['b1', 'b2'], totalA: 1, totalB: 5, offset: 0, limit: 2 })
      .mockResolvedValueOnce({ listA: [], listB: ['b3', 'b4'], totalA: 1, totalB: 5, offset: 2, limit: 2 });
    const { result } = renderHook(() => usePagedDualList(fetchPage, 2, []));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.loadMore();
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.listB).toEqual(['b1', 'b2', 'b3', 'b4']));
    expect(result.current.listA).toEqual(['a1']);
    expect(fetchPage).toHaveBeenLastCalledWith(2, 2);
  });

  it('reports hasMore correctly once both lists are exhausted', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ listA: ['a1'], listB: ['b1'], totalA: 1, totalB: 1, offset: 0, limit: 2 });
    const { result } = renderHook(() => usePagedDualList(fetchPage, 2, []));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasMore).toBe(false);
  });

  it('replaces (does not append) when reset() is called', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ listA: ['a1'], listB: ['b1'], totalA: 1, totalB: 1, offset: 0, limit: 2 });
    const { result } = renderHook(() => usePagedDualList(fetchPage, 2, []));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    result.current.reset();
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(result.current.listA).toEqual(['a1']);
  });

  it('discards a stale response when a newer load() supersedes it (request race guard)', async () => {
    // Simulates fast folder-to-folder navigation: a first load(0) starts,
    // then — before it resolves — a second load(0) is triggered (reset()).
    // The second (later-issued) call resolves FIRST here; the first
    // (earlier-issued) call resolves SECOND, after. The later-issued call's
    // data must win, and the stale earlier response must be discarded
    // rather than clobbering it.
    let resolveFirst!: (value: unknown) => void;
    let resolveSecond!: (value: unknown) => void;
    const firstPromise = new Promise((resolve) => { resolveFirst = resolve; });
    const secondPromise = new Promise((resolve) => { resolveSecond = resolve; });

    const fetchPage = vi
      .fn()
      .mockImplementationOnce(() => firstPromise)
      .mockImplementationOnce(() => secondPromise);

    const { result } = renderHook(() => usePagedDualList(fetchPage, 2, []));

    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));

    result.current.reset();
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));

    // Later-issued call resolves first.
    resolveSecond({ listA: ['second-a'], listB: ['second-b'], totalA: 1, totalB: 1 });
    await waitFor(() => expect(result.current.listA).toEqual(['second-a']));
    expect(result.current.listB).toEqual(['second-b']);
    expect(result.current.isLoading).toBe(false);

    // Earlier-issued (now-stale) call resolves after — must be discarded.
    resolveFirst({ listA: ['first-a'], listB: ['first-b'], totalA: 1, totalB: 1 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.listA).toEqual(['second-a']);
    expect(result.current.listB).toEqual(['second-b']);
    expect(result.current.isLoading).toBe(false);
  });

  it('preserves previous lists/totals and clears isLoading when loadMore fails', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ listA: ['a1'], listB: ['b1', 'b2'], totalA: 1, totalB: 5, offset: 0, limit: 2 })
      .mockRejectedValueOnce(new Error('network error'));
    const { result } = renderHook(() => usePagedDualList(fetchPage, 2, []));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.loadMore();
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.listA).toEqual(['a1']);
    expect(result.current.listB).toEqual(['b1', 'b2']);
    expect(result.current.totalA).toBe(1);
    expect(result.current.totalB).toBe(5);
  });
});
