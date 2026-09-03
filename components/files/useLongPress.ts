'use client';

import { useCallback, useRef } from 'react';
import type { TouchEvent } from 'react';

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;

/**
 * Fires `onLongPress` after ~500ms of a sustained touch, cancelling if the
 * touch moves more than ~10px (so scrolling doesn't trigger it). Attach the
 * returned handlers to a touch-only surface; mouse/desktop interaction is
 * handled separately (right-click context menu).
 */
export function useLongPress(onLongPress: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPos.current = null;
  }, []);

  const onTouchStart = useCallback(
    (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      startPos.current = { x: touch.clientX, y: touch.clientY };
      timerRef.current = setTimeout(() => {
        onLongPress();
        clear();
      }, LONG_PRESS_MS);
    },
    [onLongPress, clear]
  );

  const onTouchMove = useCallback(
    (event: TouchEvent) => {
      const start = startPos.current;
      const touch = event.touches[0];
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clear();
    },
    [clear]
  );

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd: clear,
    onTouchCancel: clear,
  };
}
