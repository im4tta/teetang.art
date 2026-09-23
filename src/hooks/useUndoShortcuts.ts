import { useEffect } from "react";
import { usePosterContext } from "@/context/PosterContext";

const isTextField = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/** Ctrl/⌘+Z undoes and Ctrl/⌘+Shift+Z or Ctrl+Y redoes, except while typing in a field. */
export function useUndoShortcuts() {
  const { dispatch } = usePosterContext();
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || isTextField(event.target)) return;
      const key = event.key.toLowerCase();
      const type =
        key === "y" || (key === "z" && event.shiftKey) ? "REDO" : key === "z" ? "UNDO" : null;
      if (!type) return;
      event.preventDefault();
      dispatch({ type });
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dispatch]);
}
