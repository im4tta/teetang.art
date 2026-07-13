import type { CSSProperties } from "react";
import { MapPin, Palette, Layout, Shapes } from "lucide-react";
import { themeOptions } from "@/services/theme/themeRepository";
import type { PosterForm } from "@/context/posterReducer";
import { useI18n } from "@/context/i18n/context";

interface Props {
  form: PosterForm;
  layoutLabel: string;
  isDualCity: boolean;
  isMobile: boolean;
  badgeVisible: boolean;
  isEditing: boolean;
  badgeTimerRef: React.RefObject<ReturnType<typeof setTimeout> | null>;
  onVisibilityChange: (visible: boolean) => void;
}

const BADGE_STYLE: CSSProperties = {
  background: "rgba(11,15,25,0.92)",
  border: "1px solid #1e2a47",
  borderRadius: 12,
  padding: "10px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  backdropFilter: "blur(8px)",
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
  maxWidth: 220,
};

const ROW_STYLE: CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
const HINT_ROW_STYLE: CSSProperties = { display: "flex", alignItems: "center", gap: 6, marginBottom: 2 };

export default function PosterInfoBadge({
  form, layoutLabel, isDualCity, isMobile, badgeVisible, isEditing, badgeTimerRef, onVisibilityChange,
}: Props) {
  const { lang } = useI18n();
  const isKhmer = lang === "km";

  const rows: [typeof MapPin, string, string, string][] = [
    [
      MapPin, "#C0392B",
      isDualCity
        ? `${form.displayCity || form.location || "Phnom Penh"} ↔ ${form.displayCity2 || form.location2 || "Paris"}`
        : `${form.displayCity || form.location || "Phnom Penh"}${form.displayCountry ? `, ${form.displayCountry}` : ""}`,
      "#F5F5FA",
    ],
    [
      Palette, "#D4AF37",
      isDualCity
        ? `${themeOptions.find(t => t.id === form.theme)?.name || form.theme} ↔ ${themeOptions.find(t => t.id === form.theme2)?.name || form.theme2 || form.theme}`
        : themeOptions.find(t => t.id === form.theme)?.name || form.theme,
      "#94A3B8",
    ],
    [Layout, "#3B82F6", isDualCity ? `Dual City • ${layoutLabel}` : layoutLabel, "#94A3B8"],
    [Shapes, "#10B981", form.mapShape, "#94A3B8"],
  ];

  const hints = [
    ["↔", isKhmer ? "អូសឆ្វេង/ស្ដាំ ដើម្បីផ្លាស់ប្ដូរស្បែក" : "Swipe left/right to change theme"],
    ["↕", isKhmer ? "អូសឡើង/ចុះ ដើម្បីផ្លាស់ប្ដូររូបរាង" : "Swipe up/down to change shape"],
  ] as const;

  const positionStyle: CSSProperties = isMobile
    ? { position: "absolute", top: 12, left: 12, zIndex: 10 }
    : { position: "absolute", bottom: 72, left: 12, zIndex: 10 };

  return (
    <div
      onMouseEnter={() => { clearTimeout(badgeTimerRef.current!); onVisibilityChange(true); }}
      onMouseLeave={() => { if (!isEditing) badgeTimerRef.current = setTimeout(() => onVisibilityChange(false), 4000); }}
      style={{ ...positionStyle, ...BADGE_STYLE, opacity: badgeVisible ? 1 : 0, transition: "opacity 0.4s ease", pointerEvents: badgeVisible ? "auto" : "none" }}
    >
      {rows.map(([Icon, color, text, textColor]) => (
        <div key={color} style={ROW_STYLE}>
          <Icon size={12} style={{ color, flexShrink: 0 }} />
          <span style={{
            fontSize: 12, color: textColor, whiteSpace: "nowrap",
            overflow: "hidden", textOverflow: "ellipsis",
            textTransform: Icon === Shapes ? "capitalize" : undefined,
          }}>
            {text}
          </span>
        </div>
      ))}
      <div style={{ marginTop: 4, paddingTop: 6, borderTop: "1px solid #1e2a47" }}>
        {hints.map(([icon, text]) => (
          <div key={icon} style={HINT_ROW_STYLE}>
            <span style={{ fontSize: 10, color: "#64748B" }}>{icon}</span>
            <span style={{ fontSize: 10, color: "#64748B" }}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
