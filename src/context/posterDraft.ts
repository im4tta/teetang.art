import type { PosterState } from "@/context/posterReducer";

/**
 * The user's design, kept in localStorage so a refresh or a return visit
 * reopens the poster they were working on instead of starting over.
 */
const DRAFT_KEY = "teetangart.draft.v1";
/** Uploaded images can be megabytes of data URL; they are dropped first when storage is full. */
const HEAVY_FIELDS = ["logoUrl", "propAgentLogo"] as const;

type Draft = Pick<
  PosterState,
  "form" | "customColors" | "markers" | "routes" | "markerDefaults" | "routeDefaults"
>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Returns `defaults` overlaid with the saved draft, or null when there is none. */
export function loadDraft(defaults: PosterState): PosterState | null {
  let saved: unknown;
  try {
    saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
  } catch {
    return null;
  }
  if (!isRecord(saved) || !isRecord(saved.form)) return null;

  // Only keep fields the current form still has, with the type it expects, so
  // drafts written by older versions can never break the editor.
  const form = { ...defaults.form };
  for (const [key, value] of Object.entries(saved.form)) {
    if (key in form && typeof value === typeof form[key as keyof typeof form]) {
      (form as Record<string, unknown>)[key] = value;
    }
  }
  return {
    ...defaults,
    form,
    customColors: isRecord(saved.customColors)
      ? (saved.customColors as Draft["customColors"])
      : defaults.customColors,
    markers: Array.isArray(saved.markers) ? (saved.markers as Draft["markers"]) : defaults.markers,
    routes: Array.isArray(saved.routes) ? (saved.routes as Draft["routes"]) : defaults.routes,
    markerDefaults: { ...defaults.markerDefaults, ...(saved.markerDefaults as object) },
    routeDefaults: { ...defaults.routeDefaults, ...(saved.routeDefaults as object) },
  };
}

export function saveDraft(draft: Draft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    try {
      const lighter = { ...draft, form: { ...draft.form } };
      for (const field of HEAVY_FIELDS) lighter.form[field] = "";
      localStorage.setItem(DRAFT_KEY, JSON.stringify(lighter));
    } catch {
      // Storage unavailable (private mode) or still full; the editor works without it.
    }
  }
}
