import { Download, MapPin, Palette, Plus, Type } from "lucide-react";
import { useI18n } from "@/context/i18n/context";
import type { TranslationKey } from "@/context/i18n/types";
import type { MobileGroup } from "@/components/layout/mobileGroups";

/** Desktop settings panels (the desktop top bar still uses these). */
export type MobileTab =
  | "settings"
  | "location"
  | "theme"
  | "layout"
  | "dualCity"
  | "style"
  | "layers"
  | "markers"
  | "routes";

export type MobileNavTarget = Exclude<MobileGroup, "settings"> | "download";

const TABS: { id: MobileNavTarget; labelKey: TranslationKey; Icon: typeof MapPin }[] = [
  { id: "place", labelKey: "mnav.place", Icon: MapPin },
  { id: "look", labelKey: "mnav.style", Icon: Palette },
  { id: "text", labelKey: "mnav.text", Icon: Type },
  { id: "add", labelKey: "mnav.add", Icon: Plus },
  { id: "download", labelKey: "export.download", Icon: Download },
];

interface Props {
  activeGroup: MobileGroup | null;
  onSelect: (target: MobileNavTarget) => void;
}

export default function MobileNavBar({ activeGroup, onSelect }: Props) {
  const { t } = useI18n();
  return (
    <div className="mobile-nav-wrapper">
      <nav className="mobile-nav mobile-nav--fixed" aria-label={t("nav.settings")}>
        {TABS.map(({ id, labelKey, Icon }) => {
          const isActive = id === activeGroup;
          return (
            <button
              key={id}
              data-tab={id}
              type="button"
              className={`mobile-nav-tab${isActive ? " is-active" : ""}${id === "download" ? " mobile-nav-tab--primary" : ""}`}
              onClick={() => onSelect(id)}
              aria-pressed={id === "download" ? undefined : isActive}
            >
              <Icon className="mobile-nav-icon" aria-hidden="true" />
              <span className="mobile-nav-label">{t(labelKey)}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
