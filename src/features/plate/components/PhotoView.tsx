import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { useI18n } from "@/context/i18n/context";
import { notify } from "@/services/notify";
import { reportProblem } from "@/utils/reportProblem";
import { triggerDownloadBlob } from "@/services/export/fileDownloader";
import type { PhotoInput, PhotoSession } from "../photo";

interface PhotoViewProps {
  input: PhotoInput;
  backdrop: string;
  fileName: string;
  onClose: () => void;
}

// Phones get fewer samples: each one costs a full frame of GPU time.
const TARGET_SAMPLES = (navigator.hardwareConcurrency ?? 8) <= 4 ? 96 : 220;

/** A realistic render of the current view, building up over the plate. */
export default function PhotoView({ input, backdrop, fileName, onClose }: PhotoViewProps) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<PhotoSession | null>(null);
  const [progress, setProgress] = useState({ samples: 0, done: false });
  const [status, setStatus] = useState<"preparing" | "rendering" | "failed">("preparing");

  useEffect(() => {
    let cancelled = false;
    import("../photo")
      .then(({ startPhoto }) =>
        startPhoto(canvasRef.current!, input, {
          backdrop,
          samples: TARGET_SAMPLES,
          onProgress: (samples, done) => !cancelled && setProgress({ samples, done }),
        }),
      )
      .then(
        (session) => {
          if (cancelled) {
            session.stop();
            return;
          }
          sessionRef.current = session;
          setStatus("rendering");
        },
        (error) => {
          console.error("Photo render failed", error);
          reportProblem("photo");
          if (!cancelled) setStatus("failed");
        },
      );
    return () => {
      cancelled = true;
      sessionRef.current?.stop();
      sessionRef.current = null;
    };
  }, [input, backdrop]);

  const save = async () => {
    try {
      const blob = await sessionRef.current!.toBlob();
      await triggerDownloadBlob(blob, fileName);
      notify(t("plate.downloaded"), { tone: "success" });
    } catch {
      notify(t("plate.downloadFailed"), { tone: "error" });
    }
  };

  const percent = Math.min(100, Math.round((progress.samples / TARGET_SAMPLES) * 100));

  return (
    <div className="plate-photo" role="dialog" aria-label={t("plate.photo")}>
      <canvas ref={canvasRef} className="plate-photo__canvas" data-samples={progress.samples} />
      <div className="plate-photo__bar">
        <div className="plate-photo__status" role="status">
          {status === "failed" ? (
            t("plate.photo.failed")
          ) : status === "preparing" ? (
            <>
              <span className="plate-spinner" aria-hidden="true" /> {t("plate.photo.preparing")}
            </>
          ) : progress.done ? (
            t("plate.photo.done")
          ) : (
            <>
              <span className="plate-photo__meter" aria-hidden="true">
                <i style={{ width: `${percent}%` }} />
              </span>
              {t("plate.photo.rendering")} {percent}%
            </>
          )}
        </div>
        <button
          type="button"
          className="plate-btn plate-btn--light"
          disabled={status !== "rendering" || progress.samples < 1}
          onClick={save}
        >
          <Download size={18} aria-hidden="true" />
          {t("plate.photo.save")}
        </button>
        <button
          type="button"
          className="plate-icon-btn"
          onClick={onClose}
          aria-label={t("plate.close")}
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
