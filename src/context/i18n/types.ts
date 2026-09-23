import type { en } from "@/context/i18n/en";

export type Language = "en" | "km";
export type TranslationKey = keyof typeof en;
export type TranslationDict = Record<TranslationKey, string>;
