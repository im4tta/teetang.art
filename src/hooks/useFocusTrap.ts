import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])";

/**
 * Modal keyboard handling: Escape calls `onEscape`, and Tab / Shift+Tab wrap
 * around inside `containerRef` instead of leaving the dialog. Inactive while
 * `active` is false.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  onEscape: () => void,
  active = true,
) {
  // Read the latest callback without re-binding the listener on every render.
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscapeRef.current();
        return;
      }
      if (event.key !== "Tab" || !containerRef.current) return;
      const focusable = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [active, containerRef]);
}
