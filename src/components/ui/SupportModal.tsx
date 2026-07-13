import { createPortal } from "react-dom";
import { KOFI_URL, SOCIAL_INSTAGRAM } from "@/services/config";
import { CloseIcon, InstagramIcon } from "@/components/ui/Icons";
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
  const kofiUrl = String(KOFI_URL ?? "").trim();
  const instagramUrl = String(SOCIAL_INSTAGRAM ?? "").trim();

  return createPortal(
    <div className="picker-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="picker-modal support-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="support-modal__close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
        <div className="support-modal__body">
          {variant === "first" ? (
            <>
              <p className="support-modal__headline" id={titleId}>
                🎉 Your first poster!
              </p>
              <p className="support-modal__text">
                Love your poster? Support us by sharing to the world.
              </p>
              <div className="support-modal__actions">
                {instagramUrl ? (
                  <a
                    className="support-modal__instagram"
                    href={instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <InstagramIcon /> Follow us
                  </a>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <p className="support-modal__headline" id={titleId}>
                ✨ Your poster is ready!
              </p>
              <p className="support-modal__text">
                If Tee Tang Art helped you create this poster, consider supporting the project.
              </p>
              <p className="support-modal__text">
                This was your poster <strong>#{posterNumber}</strong> 🎉
              </p>
              <div className="support-modal__actions">
                {kofiUrl ? (
                  <a
                    className="support-modal__kofi"
                    href={kofiUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="heart">❤︎</span> Support on Ko-fi
                  </a>
                ) : null}
                {instagramUrl ? (
                  <a
                    className="support-modal__instagram"
                    href={instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <InstagramIcon /> Follow us
                  </a>
                ) : (
                  <button type="button" className="support-modal__dismiss" onClick={onClose}>
                    Close
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
