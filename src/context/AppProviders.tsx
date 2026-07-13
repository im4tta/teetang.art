import type { ReactNode } from "react";
import { PosterProvider } from "@/context/PosterContext";
import { I18nProvider } from "@/context/i18n/context";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <PosterProvider>{children}</PosterProvider>
    </I18nProvider>
  );
}
