import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Language, TranslationKey } from "@/context/i18n/types";
import { en } from "@/context/i18n/en";
import { km } from "@/context/i18n/km";

const DICT: Record<Language, Record<TranslationKey, string>> = { en, km };

interface I18nCtx { lang: Language; setLang: (l: Language) => void; t: (k: TranslationKey) => string; toggleLang: () => void }
const I18nContext = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>("km");
  const t = useCallback((k: TranslationKey) => DICT[lang][k] ?? k, [lang]);
  const toggleLang = useCallback(() => setLang(p => p === "en" ? "km" : "en"), []);
  const value = useMemo(() => ({ lang, setLang, t, toggleLang }), [lang, t, toggleLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be within I18nProvider");
  return ctx;
}
