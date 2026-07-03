import { useEffect, useState } from "react";
import { useExport } from "@/features/export/application/useExport";
import type { ExportFormat } from "@/features/export/domain/types";
import { CloseIcon, DownloadIcon, LoaderIcon } from "@/shared/ui/Icons";
import SocialLinkGroup from "@/shared/ui/SocialLinkGroup";
import { useI18n } from "@/shared/i18n/context";
import { usePosterContext } from "@/features/poster/ui/PosterContext";

const FORMAT_OPTIONS: { format: ExportFormat; labelKey: string }[] = [
  { format: "png", labelKey: "export.png" },
  { format: "pdf", labelKey: "export.pdf" },
  { format: "svg", labelKey: "export.rsvg" },
];

interface ExportFabProps {
  isMobile: boolean;
}

export default function ExportFab({ isMobile }: ExportFabProps) {
  const { t } = useI18n();
  const { state } = usePosterContext();
  const { form } = state;
  const { isExporting, exportPoster } = useExport();
  const [isOpen, setIsOpen] = useState(false);
  const [activeFormat, setActiveFormat] = useState<ExportFormat | null>(null);

  useEffect(() => {
    if (!isExporting && activeFormat) {
      setActiveFormat(null);
      setIsOpen(false);
    }
  }, [isExporting, activeFormat]);

  const runExport = (format: ExportFormat) => {
    setActiveFormat(format);
    void exportPoster(format);
  };

  const handleShare = async (platform: string) => {
    const city = form.displayCity || form.location || "My location";
    const lat = form.latitude;
    const lon = form.longitude;
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
    const text = `Check out this map poster for ${city}: ${mapUrl}`;
    const encoded = encodeURIComponent(text);

    switch (platform) {
      case "share": {
        if (typeof navigator !== "undefined" && "share" in navigator) {
          try {
            await (navigator as Navigator & { share: (data: any) => Promise<void> }).share({
              title: `Map poster for ${city}`,
              text,
              url: mapUrl,
            });
            break;
          } catch {
            // fall back to copy
          }
        }
        await navigator.clipboard.writeText(text);
        break;
      }
      case "facebook":
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(mapUrl)}`,
          "_blank",
          "noopener,noreferrer",
        );
        break;
      case "twitter":
        window.open(
          `https://twitter.com/intent/tweet?text=${encoded}`,
          "_blank",
          "noopener,noreferrer",
        );
        break;
      case "telegram":
        window.open(
          `https://t.me/share/url?url=${encodeURIComponent(mapUrl)}&text=${encodeURIComponent(text)}`,
          "_blank",
          "noopener,noreferrer",
        );
        break;
      case "copy":
        await navigator.clipboard.writeText(text);
        break;
    }
  };

  const triggerClass = isMobile ? "mobile-export-fab-trigger" : "export-fab-trigger-desktop";

  return (
    <>
      <button
        type="button"
        className={triggerClass}
        aria-label={t("export.exportPoster")}
        title={t("export.exportPoster")}
        onClick={() => setIsOpen(true)}
      >
        <DownloadIcon />
        {!isMobile && <span>{t("export.download")}</span>}
      </button>

      {isOpen ? (
        <div
          className="export-modal-backdrop"
          role="presentation"
          onClick={() => !isExporting && setIsOpen(false)}
        >
          <div
            className="export-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="export-modal-header">
              <h3 id="export-modal-title">{t("export.downloadPoster")}</h3>
              <button
                type="button"
                className="export-modal-close"
                onClick={() => !isExporting && setIsOpen(false)}
                aria-label={t("export.closeOptions")}
              >
                <CloseIcon />
              </button>
            </div>

            <div className="export-modal-actions">
              {FORMAT_OPTIONS.map(({ format, labelKey }) => {
                const label = t(labelKey as any);
                return (
                  <button
                    key={labelKey}
                    type="button"
                    className={`export-modal-option export-modal-option--${format}`}
                    onClick={() => runExport(format)}
                    disabled={isExporting}
                  >
                    {isExporting && activeFormat === format ? (
                      <LoaderIcon className="export-modal-option-icon is-spinning" />
                    ) : (
                      <DownloadIcon className="export-modal-option-icon" />
                    )}
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ padding: "0 16px 12px" }}>
              <p
                style={{
                  fontSize: "0.7rem",
                  color: "#94A3B8",
                  margin: "0 0 8px",
                  textAlign: "center",
                }}
              >
                Share
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                {[
                  { id: "share", label: "Share" },
                  { id: "facebook", label: "Facebook" },
                  { id: "twitter", label: "X / Twitter" },
                  { id: "telegram", label: "Telegram" },
                  { id: "copy", label: "Copy link" },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    className="general-header-text-btn"
                    style={{
                      flex: "1 1 auto",
                      minWidth: 80,
                      justifyContent: "center",
                      fontSize: "0.65rem",
                    }}
                    onClick={() => void handleShare(btn.id)}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="export-modal-support-label">{t("export.supportProject")}</p>
            <SocialLinkGroup variant="mobile-export" />
          </div>
        </div>
      ) : null}
    </>
  );
}
