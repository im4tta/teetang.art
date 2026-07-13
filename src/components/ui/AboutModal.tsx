import { createPortal } from "react-dom";
import InfoPanel from "@/components/ui/InfoPanel";
import { CloseIcon } from "@/components/ui/Icons";
import { useI18n } from "@/context/i18n/context";

interface AboutModalProps {
  onClose: () => void;
}

export default function AboutModal({ onClose }: AboutModalProps) {
  const { t } = useI18n();
  return createPortal(
    <div className="about-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="about-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t("about.title")}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="about-modal-close"
          onClick={onClose}
          aria-label={t("about.close")}
        >
          <CloseIcon />
        </button>
        <InfoPanel />
      </div>
    </div>,
    document.body,
  );
}
