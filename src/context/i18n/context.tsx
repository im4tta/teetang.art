import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Language, TranslationKey } from "@/context/i18n/types";
import { en } from "@/context/i18n/en";
import { km } from "@/context/i18n/km";

const DICT: Record<Language, Record<TranslationKey, string>> = { en, km };

interface I18nCtx {
  lang: Language;
  setLang: (l: Language) => void;
  t: (k: TranslationKey) => string;
  toggleLang: () => void;
}
const I18nContext = createContext<I18nCtx | null>(null);

const LANG_STORAGE_KEY = "teetangart.lang";

function readStoredLang(): Language {
  if (typeof window === "undefined") return "km";
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    return stored === "en" || stored === "km" ? stored : "km";
  } catch {
    return "km";
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(readStoredLang);
  const t = useCallback((k: TranslationKey) => DICT[lang][k] ?? k, [lang]);
  const toggleLang = useCallback(() => setLang((p) => (p === "en" ? "km" : "en")), []);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Ignore storage failures (private mode, quota).
    }
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t, toggleLang }), [lang, t, toggleLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be within I18nProvider");
  return ctx;
}
