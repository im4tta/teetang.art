/**
 * Parses a numeric input field value, throwing if invalid.
 */
/**
 * Ensures a positive number, falling back to a default if invalid or non-positive.
 * Consolidates the duplicated toPositiveNumber / normalizePositiveNumber.
 */
export function toPositiveNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}
