import { FilePlus2 } from "lucide-react";
import { usePosterDispatch } from "@/context/PosterContext";
import { useI18n } from "@/context/i18n/context";

/** Clears the autosaved design after the user confirms. */
export default function NewPosterButton({
  className,
  withLabel = false,
}: {
  className: string;
  withLabel?: boolean;
}) {
  const { dispatch } = usePosterDispatch();
  const { t } = useI18n();
  const label = t("design.new");
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.confirm(t("design.newConfirm")) && dispatch({ type: "RESET_DESIGN" })}
      aria-label={label}
      title={label}
    >
      <FilePlus2 size={16} aria-hidden="true" />
      {withLabel && <span>{label}</span>}
    </button>
  );
}
