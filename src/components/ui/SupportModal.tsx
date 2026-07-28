import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ABA_ACCOUNT, SOCIAL_INSTAGRAM } from "@/services/config";
import { CloseIcon, InstagramIcon } from "@/components/ui/Icons";
import AbaLogo from "@/components/ui/AbaLogo";
import { useI18n } from "@/context/i18n/context";
import type { SupportPromptVariant } from "@/hooks/useExport";

interface SupportModalProps {
  posterNumber: number;
  variant: SupportPromptVariant;
  onClose: () => void;
  titleId?: string;
}

export default function SupportModal({
  posterNumber,
  variant,
  onClose,
  titleId = "export-support-modal-title",
}: SupportModalProps) {
  const { t } = useI18n();
  const abaAccount = String(ABA_ACCOUNT ?? "").trim();
  const instagramUrl = String(SOCIAL_INSTAGRAM ?? "").trim();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [isAccountCopied, setIsAccountCopied] = useState(false);

  const handleCopyAccount = async () => {
    try {
      await navigator.clipboard.writeText(abaAccount);
      setIsAccountCopied(true);
      window.setTimeout(() => setIsAccountCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable; the number stays visible for manual copying.
    }
  };

  useEffect(() => {
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="picker-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="picker-modal support-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          className="support-modal__close"
          onClick={onClose}
          aria-label={t("close")}
        >
          <CloseIcon />
        </button>
        <div className="support-modal__body">
          {variant === "first" ? (
            <>
              <p className="support-modal__headline" id={titleId}>
                🎉 {t("export.yourFirstPoster")}
              </p>
              <p className="support-modal__text">{t("export.loveYourPoster")}</p>
              <div className="support-modal__actions">
                {instagramUrl ? (
                  <a
                    className="support-modal__instagram"
                    href={instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <InstagramIcon /> {t("export.followUs")}
                  </a>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <p className="support-modal__headline" id={titleId}>
                ✨ {t("export.yourPosterReady")}
              </p>
              <p className="support-modal__text">{t("export.helpedYouCreate")}</p>
              <p className="support-modal__text">
                {t("export.wasYourPoster").replace("{n}", String(posterNumber))} 🎉
              </p>
              <div className="support-modal__actions">
                {abaAccount ? (
                  <button
                    type="button"
                    className="support-modal__aba"
                    onClick={() => void handleCopyAccount()}
                    aria-label={t("support.copyAccount")}
                  >
                    <AbaLogo className="support-modal__aba-logo" />
                    <span className="support-modal__aba-copy">
                      <span className="support-modal__aba-label">{t("support.abaAccount")}</span>
                      <span className="support-modal__aba-number">{abaAccount}</span>
                    </span>
                  </button>
                ) : null}
                {instagramUrl ? (
                  <a
                    className="support-modal__instagram"
                    href={instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <InstagramIcon /> {t("export.followUs")}
                  </a>
                ) : (
                  <button type="button" className="support-modal__dismiss" onClick={onClose}>
                    {t("export.close")}
                  </button>
                )}
              </div>
              <p className="support-modal__status" role="status" aria-live="polite">
                {isAccountCopied ? t("support.accountCopied") : ""}
              </p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
