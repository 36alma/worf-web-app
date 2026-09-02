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
});
