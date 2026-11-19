import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useI18n } from "@/context/i18n/context";

interface PlateSheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Keeps the plate visible above the sheet on phones. */
  compact?: boolean;
}

/** Bottom sheet on phones, side dialog on wide screens. Escape, the backdrop and × close it. */
export default function PlateSheet({ title, onClose, children, compact }: PlateSheetProps) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, onClose);

  return createPortal(
    <div className="plate-sheet" data-compact={compact ? "true" : undefined}>
      <button
        type="button"
        className="plate-sheet__backdrop"
        aria-label={t("plate.close")}
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="plate-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="plate-sheet__header">
          <h2>{title}</h2>
          <button
            type="button"
            className="plate-icon-btn"
            onClick={onClose}
            aria-label={t("plate.close")}
            autoFocus
          >
            <X size={20} />
          </button>
        </header>
        <div className="plate-sheet__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
