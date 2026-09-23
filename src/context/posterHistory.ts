import { posterReducer, type PosterAction, type PosterState } from "@/context/posterReducer";

/** The parts of the state that make up the design, and so can be undone. */
const DESIGN_KEYS = [
  "form",
  "customColors",
  "markers",
  "routes",
  "markerDefaults",
  "routeDefaults",
  "displayNameOverrides",
] as const;
type Design = Pick<PosterState, (typeof DESIGN_KEYS)[number]>;

const MAX_STEPS = 100;
/** Changes closer together than this (typing, dragging, a follow-up geocode) form one step. */
const MERGE_WINDOW_MS = 1_000;

export interface PosterHistoryState {
  present: PosterState;
  past: Design[];
  future: Design[];
  lastChangeAt: number;
}

const pickDesign = (state: PosterState): Design =>
  Object.fromEntries(DESIGN_KEYS.map((key) => [key, state[key]])) as Design;

const designChanged = (a: PosterState, b: PosterState) =>
  DESIGN_KEYS.some((key) => a[key] !== b[key]);

export const createHistory = (present: PosterState): PosterHistoryState => ({
  present,
  past: [],
  future: [],
  lastChangeAt: 0,
});

/** posterReducer plus UNDO / REDO over the design slices. */
export function posterHistoryReducer(
  history: PosterHistoryState,
  action: PosterAction,
): PosterHistoryState {
  const { present, past, future } = history;

  if (action.type === "UNDO" || action.type === "REDO") {
    const [from, to] = action.type === "UNDO" ? [past, future] : [future, past];
    const target = from[from.length - 1];
    if (!target) return history;
    const moved = [...to, pickDesign(present)];
    const remaining = from.slice(0, -1);
    return {
      present: { ...present, ...target, activeMarkerId: null },
      past: action.type === "UNDO" ? remaining : moved,
      future: action.type === "UNDO" ? moved : remaining,
      lastChangeAt: 0,
    };
  }

  const next = posterReducer(present, action);
  if (next === present) return history;
  if (!designChanged(present, next)) return { ...history, present: next };

  const now = Date.now();
  const merge = now - history.lastChangeAt < MERGE_WINDOW_MS && past.length > 0;
  return {
    present: next,
    past: merge ? past : [...past, pickDesign(present)].slice(-MAX_STEPS),
    future: [],
    lastChangeAt: now,
  };
}
