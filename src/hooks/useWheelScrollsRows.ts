import { useEffect } from "react";

/**
 * Sideways-scrolling rows (style bar, chips, theme swatches) hide their
 * scrollbar and scroll with a swipe, which a mouse cannot do: an ordinary
 * wheel only reports up and down. This turns the wheel into sideways scrolling
 * while the pointer is over such a row, and lets the page scroll as usual once
 * the row reaches its end (or does not overflow at all).
 */
export function useWheelScrollsRows(selector: string) {
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      // Trackpads and tilt wheels already scroll sideways; leave them alone.
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const row = (event.target as Element | null)?.closest?.(selector) as HTMLElement | null;
      if (!row) return;
      const max = row.scrollWidth - row.clientWidth;
      if (max <= 1) return;
      // deltaMode 1 is lines (Firefox); turn it into pixels.
      const delta = event.deltaY * (event.deltaMode === 1 ? 32 : 1);
      const atEnd = delta > 0 ? row.scrollLeft >= max - 1 : row.scrollLeft <= 0;
      if (atEnd) return;
      event.preventDefault();
      row.scrollLeft = Math.min(max, Math.max(0, row.scrollLeft + delta));
    };
    // Not passive: preventDefault stops the page scrolling while the row moves.
    document.addEventListener("wheel", onWheel, { passive: false });
    return () => document.removeEventListener("wheel", onWheel);
  }, [selector]);
}
