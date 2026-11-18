import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IoClose } from "react-icons/io5";
import { useI18n } from "@/context/i18n/context";
import type { Language } from "@/context/i18n/types";
import { formatKhmerDate } from "@/utils/khmerDate";
import { APP_VERSION, UPDATES_URL } from "@/services/config";

type UpdateCategory =
  | "new"
  | "fixed"
  | "improved"
  | "info"
  | "community"
  | "docs"
  | "roadmap"
  | "removed"
  | "security"
  | "breaking"
  | "major"
  | "perf"
  | "core";

/** Optional link to the feature a release note describes. */
interface UpdateLink {
  link?: string;
  linkLabel?: string;
  linkLabelKm?: string;
}

interface UpdatePoint {
  type: UpdateCategory;
  text: string;
  /** Khmer text; English is shown when it is missing. */
  km?: string;
}

interface UpdateStep extends UpdateLink {
  title: string;
  km?: string;
  image: string | null;
  points: UpdatePoint[];
}

interface UpdateSummary extends UpdateLink {
  title?: string;
  titleKm?: string;
  image?: string | null;
  points: UpdatePoint[];
}

interface UpdateLabels {
  summaryTitle?: string;
  summaryTitleKm?: string;
  detailsTitle?: string;
  detailsTitleKm?: string;
}

interface UpdateVersion {
  version: string;
  date: string;
  labels?: UpdateLabels;
  summary?: UpdateSummary;
  steps: UpdateStep[];
}

interface CategoryMeta {
  icon: string;
  label: string;
  km: string;
}

const LAST_SEEN_VERSION = "last_seen_version";
const CURRENT_VERSION = APP_VERSION;

const categoryConfig: Record<UpdateCategory, CategoryMeta> = {
  new: { icon: "✨", label: "New", km: "ថ្មី" },
  fixed: { icon: "🛠️", label: "Fixed", km: "បានជួសជុល" },
  improved: { icon: "🚀", label: "Improved", km: "ប្រសើរជាងមុន" },
  info: { icon: "ℹ️", label: "Info", km: "ព័ត៌មាន" },
  community: { icon: "👥", label: "Community", km: "សហគមន៍" },
  docs: { icon: "📚", label: "Docs", km: "ឯកសារ" },
  roadmap: { icon: "🎯", label: "Roadmap", km: "ផែនការ" },
  removed: { icon: "🗑️", label: "Removed", km: "បានដកចេញ" },
  security: { icon: "🔒", label: "Security", km: "សុវត្ថិភាព" },
  breaking: { icon: "⚠️", label: "Breaking", km: "ការផ្លាស់ប្ដូរធំ" },
  major: { icon: "👑", label: "Major", km: "សំខាន់" },
  perf: { icon: "⚡", label: "Performance", km: "ល្បឿន" },
  core: { icon: "🧭", label: "Core", km: "មូលដ្ឋាន" },
};

function compareVersions(a: string, b: string): number {
  const left = a.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const right = b.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) {
      return diff > 0 ? 1 : -1;
    }
  }

  return 0;
}

function toDisplayDate(isoDate: string, lang: Language): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  if (lang === "km") return formatKhmerDate(isoDate);
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  }).format(date);
}

function resolveImagePath(image: string | null, updatesUrl: string): string | null {
  if (!image) {
    return null;
  }

  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  try {
    const updatesBase = new URL(updatesUrl, window.location.origin);
    return new URL(image, updatesBase).toString();
  } catch {
    return image;
  }
}

const pick = (lang: Language, en: string | undefined, km: string | undefined) =>
  (lang === "km" && km?.trim()) || en?.trim() || "";

function renderPointText(text: string) {
  const separatorIndex = text.indexOf(":");
  if (separatorIndex <= 0) {
    return <span>{text}</span>;
  }

  const what = text.slice(0, separatorIndex).trim();
  const why = text.slice(separatorIndex + 1).trim();

  return (
    <span>
      <strong>{what}:</strong> {why}
    </span>
  );
}

export default function AnnouncementModal() {
  const { lang, t } = useI18n();
  const [viewMode, setViewMode] = useState<"summary" | "details">("summary");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [release, setRelease] = useState<UpdateVersion | null>(null);

  useEffect(() => {
    if (!CURRENT_VERSION || !UPDATES_URL) {
      return;
    }

    const lastSeenVersion = localStorage.getItem(LAST_SEEN_VERSION) ?? "0.0.0";

    // Don't show a modal on the very first visit.
    if (lastSeenVersion === "0.0.0") {
      localStorage.setItem(LAST_SEEN_VERSION, CURRENT_VERSION);
      return;
    }
    const isNewer = compareVersions(CURRENT_VERSION, lastSeenVersion) > 0;

    if (!isNewer) {
      return;
    }

    const controller = new AbortController();

    async function loadUpdates() {
      try {
        setLoading(true);
        const response = await fetch(UPDATES_URL, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          return;
        }

        const data: unknown = await response.json();
        if (!Array.isArray(data)) {
          return;
        }

        const targetRelease = (data as UpdateVersion[]).find(
          (item) => item.version === CURRENT_VERSION,
        );
        if (!targetRelease || !Array.isArray(targetRelease.steps)) {
          return;
        }

        setRelease(targetRelease);
        setViewMode("summary");
        setCurrentStep(0);
        setOpen(true);
      } catch {
        // Silent fail: modal remains hidden if updates URL is unavailable.
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadUpdates();

    return () => {
      controller.abort();
    };
  }, []);

  const totalSteps = release?.steps.length ?? 0;
  const isDetailsMode = viewMode === "details";
  const isLastStep = totalSteps > 0 && currentStep === totalSteps - 1;
  const progressPercent = isDetailsMode
    ? totalSteps > 0
      ? Math.round(((currentStep + 1) / totalSteps) * 100)
      : 0
    : 0;
  const activeStep = useMemo(
    () => (release?.steps ? release.steps[currentStep] : null),
    [release, currentStep],
  );
  const summaryPoints = useMemo(() => {
    if (!release) {
      return [];
    }
    if (Array.isArray(release.summary?.points) && release.summary.points.length > 0) {
      return release.summary.points;
    }

    return release.steps.flatMap((step) => step.points).slice(0, 4);
  }, [release]);
  const summaryTitle =
    pick(lang, release?.summary?.title, release?.summary?.titleKm) || t("updates.highlights");
  const summaryHeaderTitle =
    pick(lang, release?.labels?.summaryTitle, release?.labels?.summaryTitleKm) ||
    t("updates.whatsNew");
  const detailsHeaderTitle =
    pick(lang, release?.labels?.detailsTitle, release?.labels?.detailsTitleKm) ||
    t("updates.details");

  function closeModal() {
    if (CURRENT_VERSION) {
      localStorage.setItem(LAST_SEEN_VERSION, CURRENT_VERSION);
    }
    setOpen(false);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeModal();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function handleNext() {
    if (!release) {
      return;
    }

    if (isLastStep) {
      closeModal();
      return;
    }

    setCurrentStep((value) => Math.min(value + 1, release.steps.length - 1));
  }

  function handleBack() {
    setCurrentStep((value) => Math.max(value - 1, 0));
  }

  if (
    !open ||
    !release ||
    (isDetailsMode && !activeStep) ||
    (viewMode === "summary" && summaryPoints.length === 0) ||
    loading
  ) {
    return null;
  }

  const shown: (UpdateLink & { image?: string | null }) | undefined = isDetailsMode
    ? (activeStep ?? undefined)
    : release.summary;
  const resolvedImagePath = resolveImagePath(shown?.image ?? null, UPDATES_URL);
  const linkLabel = pick(lang, shown?.linkLabel, shown?.linkLabelKm);

  return (
    <div className="updates-modal-backdrop" role="presentation" onClick={closeModal}>
      <section
        className="updates-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="updates-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        {isDetailsMode ? (
          <div className="updates-modal-progress">
            <div className="updates-modal-progress-bar" style={{ width: `${progressPercent}%` }} />
          </div>
        ) : null}

        <button
          type="button"
          className="updates-modal-close"
          onClick={closeModal}
          aria-label={t("updates.close")}
        >
          <IoClose className="updates-modal-close-icon" />
        </button>

        <header className="updates-modal-header">
          <span className="updates-version-badge">
            {t("updates.version")} {release.version}
          </span>
          <h2 id="updates-modal-title">
            {isDetailsMode ? detailsHeaderTitle : summaryHeaderTitle}
          </h2>
          <p className="updates-released-on">
            {t("updates.releasedOn")} {toDisplayDate(release.date, lang)}
          </p>
        </header>

        <div className="updates-modal-content">
          <h3>{isDetailsMode ? pick(lang, activeStep?.title, activeStep?.km) : summaryTitle}</h3>
          {resolvedImagePath ? (
            <img className="updates-step-image" src={resolvedImagePath} alt="" loading="lazy" />
          ) : null}
          {shown?.link && linkLabel ? (
            <Link to={shown.link} className="updates-try-link" onClick={closeModal}>
              {linkLabel} →
            </Link>
          ) : null}
          <ul className="updates-points">
            {(isDetailsMode && activeStep ? activeStep.points : summaryPoints).map(
              (point, index) => {
                const category = categoryConfig[point.type] ?? categoryConfig.improved;

                return (
                  <li
                    key={`${point.type}-${index}`}
                    className={`updates-point updates-point--${point.type}`}
                  >
                    <span className="updates-point-icon" aria-hidden="true">
                      {category.icon}
                    </span>
                    <div className="updates-point-text">
                      <span className="updates-point-label">
                        {lang === "km" ? category.km : category.label}
                      </span>
                      {renderPointText(pick(lang, point.text, point.km))}
                    </div>
                  </li>
                );
              },
            )}
          </ul>
        </div>

        <footer className="updates-modal-footer">
          <div className="updates-footer-row">
            <div className="updates-actions">
              {isDetailsMode ? (
                <>
                  <button type="button" onClick={handleBack} disabled={currentStep === 0}>
                    {t("updates.back")}
                  </button>
                  <button type="button" className="updates-next-button" onClick={handleNext}>
                    {isLastStep ? t("updates.finish") : t("updates.next")}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="updates-next-button"
                    onClick={() => setViewMode("details")}
                  >
                    {t("updates.showDetails")}
                  </button>
                  <button type="button" className="updates-okay-button" onClick={closeModal}>
                    {t("updates.ok")}
                  </button>
                </>
              )}
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}
