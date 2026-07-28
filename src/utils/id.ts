let counter = 0;

/**
 * Collision-free id generator for client-side entities (markers, routes, …).
 *
 * `Date.now()` alone collides when two entities are created inside the same
 * millisecond — easy to hit with a double-click or a fast drag.
 */
export function createId(prefix: string): string {
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}
