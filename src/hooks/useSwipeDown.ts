import { useRef } from "react";

/**
 * Restricts swipe-to-close to the drag handle only.
 * - `sheetRef`  — attach to the sheet wrapper (receives the translateY transform)
 * - `handleRef` — attach to the handle bar (the only area that initiates a drag)
 *
 * Scrollable content inside the sheet is unaffected.
 */
export function useSwipeDown(
  onClose: () => void,
  threshold = 80,
  options?: {
    onExpand?: () => void;
  },
) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    if (sheetRef.current) sheetRef.current.style.transition = "none";
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientY - startY.current;
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientY - startY.current;
    if (sheetRef.current) {
      sheetRef.current.style.transition = "";
      sheetRef.current.style.transform = "";
    }
    const expandThreshold = 60;
    if (delta < -expandThreshold) {
      options?.onExpand?.();
      return;
    }

    if (delta > threshold) {
      onClose();
    }
  };

  const handleProps = { onTouchStart, onTouchMove, onTouchEnd };

  return { sheetRef, handleRef, handleProps };
}
