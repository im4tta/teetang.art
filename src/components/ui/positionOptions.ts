import type { TranslationKey } from "@/context/i18n/types";

/** Placement choices for the QR code and logo, with their label keys. */
export const POSITION_OPTIONS: readonly (readonly [string, TranslationKey])[] = [
  ["bottom-right", "pos.bottomRight"],
  ["bottom-left", "pos.bottomLeft"],
  ["top-right", "pos.topRight"],
  ["top-left", "pos.topLeft"],
  ["center", "text.center"],
  ["custom", "pos.custom"],
];
