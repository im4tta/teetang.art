/**
 * Classroom lessons. Each opens a place from Explore (or keeps the current
 * plate) and walks through a few steps; a step can flatten or raise the
 * relief, or change the plate (show water, raise the water level) while
 * its text explains what is happening. Texts: plate.lesson.<id>.<step>.
 */
import type { PlateSettings } from "./plateSettings";

export interface LessonStep {
  /** "flat" shows the contour map flat; "rise" lifts it into its real shape. */
  relief?: "flat" | "rise";
  /** Changes to the plate for this step. */
  patch?: Partial<PlateSettings>;
}

export interface Lesson {
  id: string;
  /** Explore place the lesson opens, or null to use the plate as it is. */
  place: string | null;
  steps: LessonStep[];
}

export const LESSONS: Lesson[] = [
  {
    id: "contours",
    place: null,
    steps: [{ relief: "flat" }, { relief: "rise" }, {}, {}],
  },
  {
    id: "watershed",
    place: "kulen",
    steps: [
      { patch: { style: "drawing", lakes: false } },
      { patch: { lakes: true } },
      { patch: { style: "elevation", palette: "tropical" } },
    ],
  },
  {
    id: "volcano",
    place: "yeak-laom",
    steps: [
      { patch: { style: "elevation", palette: "volcanic", lakes: false } },
      { patch: { lakes: true } },
      { patch: { style: "drawing", density: "more" } },
    ],
  },
  {
    id: "flood",
    place: "tonle-sap",
    steps: [{ patch: { flood: 1 } }, { patch: { flood: 5 } }, { patch: { flood: 9 } }],
  },
];

export const lessonById = (id: string) => LESSONS.find((lesson) => lesson.id === id);
