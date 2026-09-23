import { Redo2, Undo2 } from "lucide-react";
import { usePosterContext } from "@/context/PosterContext";
import { useI18n } from "@/context/i18n/context";

export default function UndoRedoButtons({
  className,
  withLabel = false,
}: {
  className: string;
  withLabel?: boolean;
}) {
  const { dispatch, canUndo, canRedo } = usePosterContext();
  const { t } = useI18n();
  const buttons = [
    { type: "UNDO", label: t("design.undo"), Icon: Undo2, enabled: canUndo },
    { type: "REDO", label: t("design.redo"), Icon: Redo2, enabled: canRedo },
  ] as const;
  return buttons.map(({ type, label, Icon, enabled }) => (
    <button
      key={type}
      type="button"
      className={className}
      onClick={() => dispatch({ type })}
      disabled={!enabled}
      aria-label={label}
      title={label}
    >
      <Icon size={16} aria-hidden="true" />
      {withLabel && <span>{label}</span>}
    </button>
  ));
}
