import { useState } from "react";
import { CloudDownload, Columns2, GraduationCap, Trash2, X } from "lucide-react";
import { useI18n } from "@/context/i18n/context";
import { EXPLORE_CAMBODIA, EXPLORE_WORLD, type ExplorePlace, type SavedPlate } from "../explore";
import PlateSheet from "./PlateSheet";
import { LESSONS } from "../lessons";
import type { TranslationKey } from "@/context/i18n/types";

interface ExploreSheetProps {
  saved: SavedPlate[];
  comparing: string | null;
  onOpen: (place: ExplorePlace) => void;
  onCompare: (place: ExplorePlace | null) => void;
  onLesson: (id: string) => void;
  onSaveOffline: () => Promise<void>;
  onOpenSaved: (saved: SavedPlate) => void;
  onDeleteSaved: (saved: SavedPlate) => void;
  onClose: () => void;
}

export default function ExploreSheet({
  saved,
  comparing,
  onOpen,
  onCompare,
  onLesson,
  onSaveOffline,
  onOpenSaved,
  onDeleteSaved,
  onClose,
}: ExploreSheetProps) {
  const { t, lang } = useI18n();
  const [saving, setSaving] = useState(false);

  const card = (place: ExplorePlace) => (
    <article key={place.id} className="plate-explore-card">
      <button type="button" className="plate-explore-card__open" onClick={() => onOpen(place)}>
        <strong>{place.name}</strong>
        <span className="plate-explore-card__meta">
          {[place.region, place.country].filter(Boolean).join(", ")} · {place.sizeKm} km
        </span>
        <span className="plate-explore-card__story">{place.story[lang]}</span>
      </button>
      <button
        type="button"
        className="plate-icon-btn"
        aria-label={`${t("plate.explore.compareWith")} ${place.name}`}
        title={t("plate.explore.compareWith")}
        onClick={() => onCompare(place)}
      >
        <Columns2 size={18} />
      </button>
    </article>
  );

  return (
    <PlateSheet title={t("plate.explore.title")} onClose={onClose}>
      <section className="plate-field plate-group" aria-label={t("plate.lesson.classroom")}>
        <h3 className="plate-field__label">
          <GraduationCap size={18} aria-hidden="true" /> {t("plate.lesson.classroom")}
        </h3>
        {LESSONS.map((lesson) => (
          <button
            key={lesson.id}
            type="button"
            className="plate-btn plate-btn--soft plate-lesson-btn"
            onClick={() => onLesson(lesson.id)}
          >
            {lesson.id === "contours"
              ? t("plate.lesson.start")
              : t(`plate.lesson.${lesson.id}.title` as TranslationKey)}
          </button>
        ))}
      </section>

      {comparing && (
        <div className="plate-explore-comparing">
          <span>
            {t("plate.explore.comparing")} <strong>{comparing}</strong>
          </span>
          <button
            type="button"
            className="plate-btn plate-btn--light"
            onClick={() => onCompare(null)}
          >
            <X size={18} aria-hidden="true" />
            {t("plate.explore.stopCompare")}
          </button>
        </div>
      )}

      <section className="plate-field plate-group" aria-label={t("plate.explore.saved")}>
        <h3 className="plate-field__label">{t("plate.explore.saved")}</h3>
        <button
          type="button"
          className="plate-btn plate-btn--soft"
          disabled={saving}
          aria-busy={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSaveOffline();
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? (
            <span className="plate-spinner" aria-hidden="true" />
          ) : (
            <CloudDownload size={18} aria-hidden="true" />
          )}
          {t("plate.explore.saveOffline")}
        </button>
        {saved.length === 0 ? (
          <p className="plate-note">{t("plate.explore.savedEmpty")}</p>
        ) : (
          saved.map((entry) => (
            <div key={entry.savedAt} className="plate-explore-saved">
              <button
                type="button"
                className="plate-explore-saved__open"
                onClick={() => onOpenSaved(entry)}
              >
                <strong>{entry.name || `${entry.lat.toFixed(3)}, ${entry.lon.toFixed(3)}`}</strong>
                <span>{entry.sizeKm} km</span>
              </button>
              <button
                type="button"
                className="plate-icon-btn"
                aria-label={t("plate.explore.deleteSaved")}
                onClick={() => onDeleteSaved(entry)}
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </section>

      <section className="plate-field" aria-label={t("plate.explore.cambodia")}>
        <h3 className="plate-field__label">{t("plate.explore.cambodia")}</h3>
        {EXPLORE_CAMBODIA.map(card)}
      </section>
      <section className="plate-field" aria-label={t("plate.explore.world")}>
        <h3 className="plate-field__label">{t("plate.explore.world")}</h3>
        {EXPLORE_WORLD.map(card)}
      </section>
    </PlateSheet>
  );
}
