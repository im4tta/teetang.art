import { useState } from "react";
import { useI18n } from "@/context/i18n/context";
import type { TranslationKey } from "@/context/i18n/types";
import { markQuickStartSeen, quickStartSeen } from "@/components/ui/quickStartState";

const STEPS: TranslationKey[] = ["quick.step1", "quick.step2", "quick.step3"];

/** A one-time, three-step intro for first-time phone visitors. */
export default function QuickStart() {
  const { t } = useI18n();
  const [open, setOpen] = useState(() => !quickStartSeen());
  if (!open) return null;

  const close = () => {
    markQuickStartSeen();
    setOpen(false);
  };

  return (
    <div
      className="quick-start"
      role="dialog"
      aria-modal="false"
      aria-labelledby="quick-start-title"
    >
      <h2 id="quick-start-title">{t("quick.title")}</h2>
      <ol>
        {STEPS.map((key, index) => (
          <li key={key}>
            <span className="quick-start__num" aria-hidden="true">
              {index + 1}
            </span>
            <span>{t(key)}</span>
          </li>
        ))}
      </ol>
      <button type="button" className="quick-start__go" onClick={close}>
        {t("quick.start")}
      </button>
    </div>
  );
}
