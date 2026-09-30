import type { TranslationKey } from "@/context/i18n/types";

/** Settings sections SettingsPanel can render. */
export type SectionId =
  "app" | "location" | "theme" | "layout" | "dualCity" | "style" | "layers" | "markers" | "routes";

/** The phone bottom bar groups the settings into a few plain-language tabs. */
export type MobileGroup = "place" | "look" | "text" | "add" | "settings";

export const MOBILE_GROUPS: Record<
  MobileGroup,
  { labelKey: TranslationKey; sections: SectionId[] }
> = {
  place: { labelKey: "mnav.place", sections: ["location", "dualCity"] },
  look: { labelKey: "mnav.style", sections: ["theme", "layout", "layers"] },
  text: { labelKey: "mnav.text", sections: ["style"] },
  add: { labelKey: "mnav.add", sections: ["markers", "routes"] },
  settings: { labelKey: "nav.settings", sections: ["app"] },
};

/** Fired to open the download sheet from outside ExportFab (the bottom bar). */
export const OPEN_EXPORT_EVENT = "teetangart:open-export";
