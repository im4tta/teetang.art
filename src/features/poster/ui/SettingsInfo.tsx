interface SettingsInfoProps {
  location: string;
  theme: string;
  layout: string;
  posterSize: string;
  markers: string;
  coordinates: string;
}

import { useI18n } from "@/shared/i18n/context";

export default function SettingsInfo({
  location,
  theme,
  layout,
  posterSize,
  markers,
  coordinates,
}: SettingsInfoProps) {
  const { t } = useI18n();
  const rows = [
    { label: t("info.location"), value: location },
    { label: t("info.theme"), value: theme },
    { label: t("info.markers"), value: markers },
    { label: t("info.zoom"), value: layout },
    { label: t("info.size"), value: posterSize },
    { label: t("info.coordinates"), value: coordinates },
  ];

  return (
    <section className="settings-info-card" aria-label="Current settings">
      <h3 className="settings-info-title">{t("info.location")}</h3>
      <dl className="settings-info-list">
        {rows.map((row) => (
          <div key={row.label} className="settings-info-row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
