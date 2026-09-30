const SEEN_KEY = "teetangart.quickstart.v1";

/** Whether the one-time phone quick start has been dismissed. */
export function quickStartSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markQuickStartSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Shown again next visit; harmless.
  }
}
