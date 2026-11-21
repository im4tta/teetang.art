import { track } from "@vercel/analytics";

/**
 * Counts a failure in Vercel Analytics, so problems real visitors hit show up
 * in the dashboard. Only the kind of failure is sent (e.g. "terrain"),
 * never the place, a link or anything else about the visitor.
 * Custom events need a Vercel plan that includes them; elsewhere this does nothing.
 */
export type ProblemKind =
  | "terrain"
  | "imagery"
  | "lakes"
  | "city"
  | "photo"
  | "ar"
  | "video"
  | "download"
  | "offline"
  | "track-import";

export function reportProblem(kind: ProblemKind) {
  try {
    track("plate_problem", { kind });
  } catch {
    // Analytics must never break the page.
  }
}
