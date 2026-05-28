import type { ReactNode } from "react";
import { PosterProvider } from "@/features/poster/ui/PosterContext";
import { I18nProvider } from "@/shared/i18n/context";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <PosterProvider>{children}</PosterProvider>
    </I18nProvider>
  );
}
