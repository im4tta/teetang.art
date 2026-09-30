import { useEffect, useState } from "react";
import { dismiss, subscribe, type Toast } from "@/services/notify";
import { useI18n } from "@/context/i18n/context";

export default function Toaster() {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => subscribe(setToasts), []);

  return (
    <div className="app-toaster" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`app-toast app-toast--${toast.tone}`}
          role={toast.tone === "error" ? "alert" : "status"}
        >
          <span className="app-toast__message">{toast.message}</span>
          <button
            type="button"
            className="app-toast__close"
            onClick={() => dismiss(toast.id)}
            aria-label={t("toast.dismiss")}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
