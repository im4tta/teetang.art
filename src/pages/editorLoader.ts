let editorPagePromise: Promise<typeof import("@/pages/EditorPage")> | null = null;

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

export function loadEditorPage() {
  if (!editorPagePromise) {
    editorPagePromise = import("@/pages/EditorPage").catch((error) => {
      editorPagePromise = null;
      throw error;
    });
  }
  return editorPagePromise;
}

const onSlowOrMeteredConnection = () => {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return Boolean(connection?.saveData || connection?.effectiveType?.includes("2g"));
};

export function preloadEditorPage() {
  if (onSlowOrMeteredConnection()) return;
  void loadEditorPage();
}

/**
 * Downloads the editor and the map library in the background once the page has
 * settled, so tapping "create" opens a ready editor. Skipped on Save-Data/2G.
 */
export function preloadEditorWhenIdle(): () => void {
  if (onSlowOrMeteredConnection()) return () => {};
  const start = () => {
    void loadEditorPage().then(() => import("@/components/ui/MapPreview"));
  };
  // Safari has no requestIdleCallback.
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(start, { timeout: 4_000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(start, 2_500);
  return () => clearTimeout(id);
}
