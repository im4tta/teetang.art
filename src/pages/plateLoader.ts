/** The 3D plate page, loaded once and shared by the route and any early preload. */
let platePagePromise: Promise<typeof import("@/pages/PlatePage")> | null = null;

export function loadPlatePage() {
  if (!platePagePromise) {
    platePagePromise = import("@/pages/PlatePage").catch((error) => {
      platePagePromise = null;
      throw error;
    });
  }
  return platePagePromise;
}

/** Starts the download when someone points at or focuses a link to the plate. Skipped on Save-Data/2G. */
export function preloadPlatePage() {
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
  ).connection;
  if (connection?.saveData || connection?.effectiveType?.includes("2g")) return;
  void loadPlatePage();
}

/** Save-Data or a 2G/3G connection: lighter terrain and imagery. */
export function onSlowConnection(): boolean {
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
  ).connection;
  return Boolean(connection?.saveData || /2g|3g/.test(connection?.effectiveType ?? ""));
}
