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

export function preloadEditorPage() {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (connection?.saveData || connection?.effectiveType?.includes("2g")) return;
  void loadEditorPage();
}
