import { useRef, useCallback } from "react";

interface SwipeCallbacks {
  onSwipeLeft?: (startX?: number) => void;
  onSwipeRight?: (startX?: number) => void;
  onSwipeUp?: (startX?: number) => void;
  onSwipeDown?: (startX?: number) => void;
}

const SWIPE_THRESHOLD = 50;
const VERTICAL_ANGLE_THRESHOLD = 30; // degrees - prevent diagonal swipes

function processSwipe(
  startX: number,
  startY: number,
  startTime: number,
  endX: number,
  endY: number,
  callbacks: SwipeCallbacks,
) {
  const deltaTime = Date.now() - startTime;
  if (deltaTime > 600) return; // too slow, ignore

  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  // Check if movement is below threshold
  if (absX < SWIPE_THRESHOLD && absY < SWIPE_THRESHOLD) return;

  // Calculate angle to determine direction
  const angle = Math.abs((Math.atan2(absY, absX) * 180) / Math.PI);

  if (absX > absY) {
    // Horizontal swipe
    if (angle > VERTICAL_ANGLE_THRESHOLD) return; // too diagonal
    if (deltaX > 0) {
      callbacks.onSwipeRight?.(startX);
    } else {
      callbacks.onSwipeLeft?.(startX);
    }
  } else {
    // Vertical swipe
    if (angle < 90 - VERTICAL_ANGLE_THRESHOLD) return; // too diagonal
    if (deltaY > 0) {
      callbacks.onSwipeDown?.(startX);
    } else {
      callbacks.onSwipeUp?.(startX);
    }
  }
}

export function useSwipeGestures(callbacks: SwipeCallbacks) {
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);
  const isSwiping = useRef(false);
  const isMouseDown = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    startTime.current = Date.now();
    isSwiping.current = true;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isSwiping.current) return;
      isSwiping.current = false;
      processSwipe(
        startX.current,
        startY.current,
        startTime.current,
        e.changedTouches[0].clientX,
        e.changedTouches[0].clientY,
        callbacks,
      );
    },
    [callbacks],
  );

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click
    startX.current = e.clientX;
    startY.current = e.clientY;
    startTime.current = Date.now();
    isMouseDown.current = true;
  }, []);

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!isMouseDown.current) return;
      isMouseDown.current = false;
      processSwipe(
        startX.current,
        startY.current,
        startTime.current,
        e.clientX,
        e.clientY,
        callbacks,
      );
    },
    [callbacks],
  );

  return { onTouchStart, onTouchEnd, onMouseDown, onMouseUp };
}

export type SwipeHandlers = ReturnType<typeof useSwipeGestures>;
