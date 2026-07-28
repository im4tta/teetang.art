import { useEffect, useRef, useState } from "react";
import { useExport } from "@/hooks/useExport";
import type { ExportFormat } from "@/services/export/types";
import { CloseIcon, DownloadIcon, LoaderIcon } from "@/components/ui/Icons";
import SocialLinkGroup from "@/components/ui/SocialLinkGroup";
import { useI18n } from "@/context/i18n/context";
import { usePosterContext } from "@/context/PosterContext";

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const exportingRef = useRef(false);

  useEffect(() => {
    exportingRef.current = isExporting;
  }, [isExporting]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const triggerElement = triggerRef.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !exportingRef.current) {
        event.preventDefault();
        setIsOpen(false);
        return;
      }
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerElement?.focus();
    };
  }, [isOpen]);

  const runExport = async (format: ExportFormat) => {
    setActiveFormat(format);
    try {
      await exportPoster(format);
    } finally {
      setActiveFormat(null);
      setIsOpen(false);
    }
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
        ref={triggerRef}
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
            ref={modalRef}
            className="export-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="export-modal-header">
              <h3 id="export-modal-title">{t("export.downloadPoster")}</h3>
              <button
                ref={closeRef}
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

            <div className="export-modal-share">
              <p className="export-modal-share-label">{t("export.share")}</p>
              <div className="export-modal-share-actions">
                {[
                  { id: "share", label: t("export.share") },
                  { id: "facebook", label: "Facebook" },
                  { id: "twitter", label: "X / Twitter" },
                  { id: "telegram", label: "Telegram" },
                  { id: "copy", label: t("export.copyLink") },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    className="general-header-text-btn export-modal-share-btn"
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
