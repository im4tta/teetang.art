import { useCallback } from "react";
import { useI18n } from "@/shared/i18n/context";
import type { PosterForm } from "@/features/poster/application/posterReducer";
import {
  buildGoogleMapsUrl,
  buildWhatsAppUrl,
  buildAppleMapsUrl,
  buildTelegramUrl,
  buildTeeTangUrl,
} from "@/shared/utils/qrCode";

interface QRSectionProps {
  form: PosterForm;
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

function buildQrShareUrl(form: PosterForm): string {
  const lat = Number(form.latitude) || 0;
  const lon = Number(form.longitude) || 0;
  switch (form.qrDestination) {
    case "google-maps":
      return buildGoogleMapsUrl(lat, lon);
    case "apple-maps":
      return buildAppleMapsUrl(lat, lon);
    case "whatsapp":
      return form.qrPhone ? buildWhatsAppUrl(form.qrPhone) : "";
    case "telegram":
      return form.qrPhone ? buildTelegramUrl(form.qrPhone) : "";
    case "teetang-landing":
      return buildTeeTangUrl(lat, lon, form.displayCity);
    case "custom":
      return form.qrCustomUrl || "";
    default:
      return buildGoogleMapsUrl(lat, lon);
  }
}

export default function QRSection({ form, onChange }: QRSectionProps) {
  const { t } = useI18n();

  const handleShareQr = useCallback(async () => {
    const url = buildQrShareUrl(form);
    if (!url) return;
    try {
      if (typeof window !== "undefined" && "share" in window.navigator) {
        await (navigator as any).share({ title: "Map location", text: url, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // ignore
    }
  }, [form]);

  return (
    <section className="panel-block">
      <p className="section-summary-label">{t("layout.qrCode")}</p>
      <div className="ios-toggle-row">
        <span className="ios-toggle-label">{t("layout.qrCode")}</span>
        <label className="ios-toggle">
          <input
            type="checkbox"
            name="showQrCode"
            checked={Boolean(form.showQrCode)}
            onChange={onChange}
          />
          <span className="ios-track" />
        </label>
      </div>

      {form.showQrCode && (
        <>
          <label className="toggle-field" style={{ marginTop: 12 }}>
            <span>Destination</span>
            <span className="theme-select-wrapper">
              <select
                className="theme-select"
                name="qrDestination"
                value={form.qrDestination}
                onChange={onChange}
              >
                <option value="google-maps">Google Maps</option>
                <option value="apple-maps">Apple Maps</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
                <option value="teetang-landing">Tee Tang Landing</option>
                <option value="custom">Custom URL</option>
              </select>
            </span>
          </label>

          {form.qrDestination === "custom" && (
            <label>
              Custom URL
              <input
                className="form-control-tall"
                name="qrCustomUrl"
                value={form.qrCustomUrl}
                onChange={onChange}
                placeholder="https://..."
              />
            </label>
          )}

          {form.qrDestination === "whatsapp" && (
            <label>
              Phone Number
              <input
                className="form-control-tall"
                name="qrPhone"
                value={form.qrPhone}
                onChange={onChange}
                placeholder="+855..."
              />
            </label>
          )}

          {form.qrDestination === "telegram" && (
            <label>
              Telegram Username
              <input
                className="form-control-tall"
                name="qrPhone"
                value={form.qrPhone}
                onChange={onChange}
                placeholder="@username"
              />
            </label>
          )}

          <label className="toggle-field">
            <span>{t("poster.position")}</span>
            <span className="theme-select-wrapper">
              <select
                className="theme-select"
                name="qrPosition"
                value={form.qrPosition}
                onChange={onChange}
              >
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="top-right">Top Right</option>
                <option value="top-left">Top Left</option>
                <option value="center">Center</option>
                <option value="custom">Custom (drag on preview)</option>
              </select>
            </span>
          </label>

          <div className="ctrl-row">
            <span className="ctrl-label">{t("poster.size")}</span>
            <span className="ctrl-val">{form.qrSize}cq</span>
          </div>
          <input
            type="range"
            className="ref-slider"
            name="qrSize"
            min="5"
            max="40"
            step="1"
            value={form.qrSize}
            onChange={onChange}
          />

          <div className="ctrl-row">
            <span className="ctrl-label">{t("poster.opacity")}</span>
            <span className="ctrl-val">{form.qrOpacity}%</span>
          </div>
          <input
            type="range"
            className="ref-slider"
            name="qrOpacity"
            min="10"
            max="100"
            step="5"
            value={form.qrOpacity}
            onChange={onChange}
          />

          <label style={{ marginTop: 12 }}>
            {t("poster.padding")} (px)
            <input
              type="number"
              className="form-control-tall"
              name="qrPadding"
              value={form.qrPadding}
              onChange={onChange}
            />
          </label>

          <label style={{ marginTop: 12 }}>
            QR Label (e.g. "Scan to navigate")
            <input
              className="form-control-tall"
              name="qrLabel"
              value={form.qrLabel}
              onChange={onChange}
              placeholder="Scan to navigate"
            />
          </label>

          <button
            type="button"
            className="general-header-text-btn"
            style={{ width: "100%", justifyContent: "center", marginTop: 12 }}
            onClick={handleShareQr}
          >
            Share QR destination
          </button>
        </>
      )}
    </section>
  );
}
