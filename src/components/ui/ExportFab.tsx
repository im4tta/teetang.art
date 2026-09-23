import { useCallback, useEffect, useRef, useState } from "react";
import { useExport } from "@/hooks/useExport";
import type { ExportFormat } from "@/services/export/types";
import { CloseIcon, DownloadIcon, LoaderIcon } from "@/components/ui/Icons";
import SocialLinkGroup from "@/components/ui/SocialLinkGroup";
import { useI18n } from "@/context/i18n/context";
import type { TranslationKey } from "@/context/i18n/types";
import { usePosterContext } from "@/context/PosterContext";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { buildPosterLink, copyText, shareOrCopy } from "@/services/share/posterLink";

type ShareTarget = "share" | "facebook" | "twitter" | "telegram" | "copy";

const openPopup = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

/** Whether the browser's share sheet accepts image files (most phones do). */
const canShareImages = () =>
  typeof navigator.canShare === "function" &&
  navigator.canShare({ files: [new File([""], "poster.png", { type: "image/png" })] });

const FORMAT_OPTIONS: { format: ExportFormat; labelKey: TranslationKey }[] = [
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
  const { isExporting, exportPoster, renderPosterFile } = useExport();
  const [isOpen, setIsOpen] = useState(false);
  const [activeFormat, setActiveFormat] = useState<ExportFormat | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const exportingRef = useRef(false);
  const [shareFeedback, setShareFeedback] = useState<{ id: ShareTarget; label: string } | null>(
    null,
  );
  // An image rendered for sharing whose share sheet the browser refused to open
  // (the click's user activation expired while rendering); shared on the next tap.
  const [pendingImage, setPendingImage] = useState<File | null>(null);

  useEffect(() => {
    exportingRef.current = isExporting;
  }, [isExporting]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const triggerElement = triggerRef.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      triggerElement?.focus();
    };
  }, [isOpen]);

  const closeModal = useCallback(() => {
    if (!exportingRef.current) setIsOpen(false);
  }, []);
  useFocusTrap(modalRef, closeModal, isOpen);

  const runExport = async (format: ExportFormat) => {
    setActiveFormat(format);
    try {
      await exportPoster(format);
    } finally {
      setActiveFormat(null);
      setIsOpen(false);
    }
  };

  const handleShare = async (target: ShareTarget) => {
    const city = form.displayCity || form.location || "my place";
    const url = buildPosterLink(form);
    const text = t("export.shareText").replace("{city}", city);
    const title = `${city} · Tee Tang Art`;
    const flash = (label: string) => {
      setShareFeedback({ id: target, label });
      window.setTimeout(() => setShareFeedback(null), 2500);
    };

    switch (target) {
      case "share": {
        const image = pendingImage ?? (canShareImages() ? await renderPosterFile() : null);
        setPendingImage(null);
        if (image) {
          try {
            await navigator.share({ title, text: `${text} ${url}`, files: [image] });
            return;
          } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") return;
            if (error instanceof DOMException && error.name === "NotAllowedError") {
              setPendingImage(image);
              flash(t("export.tapToShareImage"));
              return;
            }
          }
        }
        if ((await shareOrCopy({ title, text, url })) === "copied") flash(t("export.linkCopied"));
        return;
      }
      case "facebook":
        openPopup(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
        return;
      case "twitter":
        openPopup(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
        );
        return;
      case "telegram":
        openPopup(
          `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
        );
        return;
      case "copy":
        if ((await copyText(url)) === "copied") flash(t("export.linkCopied"));
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
                const label = t(labelKey);
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
                {(
                  [
                    { id: "share", label: t("export.share") },
                    { id: "facebook", label: "Facebook" },
                    { id: "twitter", label: "X / Twitter" },
                    { id: "telegram", label: "Telegram" },
                    { id: "copy", label: t("export.copyLink") },
                  ] satisfies { id: ShareTarget; label: string }[]
                ).map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    className="general-header-text-btn export-modal-share-btn"
                    onClick={() => void handleShare(btn.id)}
                    disabled={isExporting}
                    aria-live="polite"
                  >
                    {shareFeedback?.id === btn.id ? shareFeedback.label : btn.label}
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
