import { useState } from "react";
import {
  Box,
  Clapperboard,
  Gift,
  Image,
  Link2,
  Package,
  PenTool,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/context/i18n/context";
import type { TranslationKey } from "@/context/i18n/types";
import PlateSheet from "./PlateSheet";

export type PlateDownload = "png" | "card" | "video" | "svg" | "stl" | "glb" | "studio" | "link";

const OPTIONS: { id: PlateDownload; icon: LucideIcon }[] = [
  { id: "png", icon: Image },
  { id: "card", icon: Gift },
  { id: "video", icon: Clapperboard },
  { id: "svg", icon: PenTool },
  { id: "stl", icon: Box },
  { id: "glb", icon: Package },
  { id: "studio", icon: Wrench },
  { id: "link", icon: Link2 },
];

interface DownloadSheetProps {
  onDownload: (kind: PlateDownload) => Promise<void>;
  onClose: () => void;
  satellite: boolean;
  /** Whether this browser can record a fly-over video. */
  video: boolean;
}

export default function DownloadSheet({
  onDownload,
  onClose,
  satellite,
  video,
}: DownloadSheetProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<PlateDownload | null>(null);

  const run = async (kind: PlateDownload) => {
    setBusy(kind);
    try {
      await onDownload(kind);
    } finally {
      setBusy(null);
    }
  };

  return (
    <PlateSheet title={t("plate.dl.title")} onClose={onClose}>
      <div className="plate-downloads">
        {OPTIONS.filter(({ id }) => video || id !== "video").map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className="plate-download"
            data-kind={id}
            disabled={busy !== null}
            aria-busy={busy === id}
            onClick={() => run(id)}
          >
            <span className="plate-download__icon" aria-hidden="true">
              {busy === id ? <span className="plate-spinner" /> : <Icon size={22} />}
            </span>
            <span className="plate-download__text">
              <strong>{t(`plate.dl.${id}` as TranslationKey)}</strong>
              <span>{t(`plate.dl.${id}Hint` as TranslationKey)}</span>
            </span>
          </button>
        ))}
      </div>
      {satellite && <p className="plate-note">{t("plate.satelliteNote")}</p>}
    </PlateSheet>
  );
}
