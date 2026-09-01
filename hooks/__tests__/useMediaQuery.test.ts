// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMediaQuery } from '../useMediaQuery';

function mockMatchMedia(matches: boolean) {
  const listeners: Array<(event: {matches: boolean}) => void> = [];
  const mql = {
    matches,
    media: '',
    addEventListener: (_type: string, listener: (event: {matches: boolean}) => void) => listeners.push(listener),
    removeEventListener: vi.fn(),
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  return {
    trigger: (next: boolean) => {
      mql.matches = next;
      listeners.forEach((listener) => listener({ matches: next }));
    },
  };
}

describe('useMediaQuery', () => {
  it('returns the initial match state', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('updates when the media query state changes', () => {
    const { trigger } = mockMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);
    act(() => trigger(true));
    expect(result.current).toBe(true);
  });
});
