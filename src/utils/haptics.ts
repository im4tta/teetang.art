/** A short vibration on Android to confirm a tap; silently ignored elsewhere. */
export function tapFeedback(pattern: number | number[] = 8): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration blocked (e.g. no user activation yet).
  }
}
