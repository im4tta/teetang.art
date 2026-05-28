import { useCallback, useEffect, useState } from "react";
import { ensureGoogleFont } from "@/core/services";
import type { PosterForm } from "@/features/poster/application/posterReducer";
import type { FontOption } from "@/core/config";
import { RADIUS_OPTIONS } from "@/core/config";
import { PLACEHOLDER_EXAMPLE_CITY, PLACEHOLDER_EXAMPLE_COUNTRY } from "@/features/location/ui/constants";
import { useI18n } from "@/shared/i18n/context";
import { usePosterContext } from "@/features/poster/ui/PosterContext";
import { LogoUploadField } from "@/features/poster/ui/LogoUploadField";
import { buildGoogleMapsUrl, buildWhatsAppUrl, buildAppleMapsUrl, buildTelegramUrl, buildTeeTangUrl } from "@/shared/utils/qrCode";

const SHAPES = ["rectangle", "rounded", "circle", "diamond", "hexagon", "star", "triangle", "heart"];

function Toggle({ label, name, checked, onChange }: { label: string; name: string; checked: boolean; onChange: (e: any) => void }) {
  return (
    <div className="ios-toggle-row">
      <span className="ios-toggle-label">{label}</span>
      <label className="ios-toggle">
        <input type="checkbox" name={name} checked={checked} onChange={onChange} />
        <span className="ios-track" />
      </label>
    </div>
  );
}

function Field({ label, name, value, onChange, type = "text", placeholder = "" }: { label: string; name: string; value: string; onChange: (e: any) => void; type?: string; placeholder?: string }) {
  return <label>{label}<input className="form-control-tall" type={type} name={name} value={value} onChange={onChange} placeholder={placeholder} /></label>;
}

function Slider({ label, name, value, min, max, step, unit = "", onChange }: { label: string; name: string; value: string | number; min: string; max: string; step: string; unit?: string; onChange: (e: any) => void }) {
  return (
    <>
      <div className="ctrl-row"><span className="ctrl-label">{label}</span><span className="ctrl-val">{value}{unit}</span></div>
      <input type="range" className="ref-slider" name={name} min={min} max={max} step={step} value={value} onChange={onChange} />
    </>
  );
}

function SelectField({ label, name, value, onChange, children }: { label: string; name: string; value: string; onChange: (e: any) => void; children: React.ReactNode }) {
  return (
    <label className="toggle-field">
      <span>{label}</span>
      <span className="theme-select-wrapper"><select className="theme-select" name={name} value={value} onChange={onChange}>{children}</select></span>
    </label>
  );
}

interface Props { form: PosterForm; onChange: (e: any) => void; fontOptions: FontOption[] }

export default function TypographySection({ form, onChange, fontOptions }: Props) {
  const { t } = useI18n();
  useEffect(() => { void Promise.allSettled(fontOptions.map(o => String(o.value || "").trim()).filter(Boolean).map(ensureGoogleFont)); }, [fontOptions]);

  return (
    <>
      <section className="panel-block">
        <p className="section-summary-label">{t("textTitle")}</p>
        <Toggle label={t("poster.text")} name="showPosterText" checked={Boolean(form.showPosterText)} onChange={onChange} />
        <Toggle label={t("poster.overlay")} name="showMarkers" checked={Boolean(form.showMarkers)} onChange={onChange} />
        <Toggle label={t("text.underline")} name="showUnderline" checked={Boolean(form.showUnderline)} onChange={onChange} />

        <div className="field-grid keep-two-mobile">
          <Field label={t("poster.displayCity")} name="displayCity" value={form.displayCity} onChange={onChange} placeholder={PLACEHOLDER_EXAMPLE_CITY} />
          <Field label={t("poster.displayCountry")} name="displayCountry" value={form.displayCountry} onChange={onChange} placeholder={PLACEHOLDER_EXAMPLE_COUNTRY} />
        </div>

        <p className="section-summary-label" style={{ marginTop: 12 }}>{t("text.footerText")}</p>
        <div className="field-grid keep-two-mobile">
          <Field label={t("text.footerName")} name="footerCity" value={form.footerCity} onChange={onChange} placeholder={PLACEHOLDER_EXAMPLE_CITY} />
          <Field label={t("text.footerSubtitle")} name="footerCountry" value={form.footerCountry} onChange={onChange} placeholder={PLACEHOLDER_EXAMPLE_COUNTRY} />
        </div>

        <label>{t("poster.font")}
          <select className="form-control-tall" name="fontFamily" value={form.fontFamily} onChange={onChange}>
            {fontOptions.map(o => <option key={o.value || "default"} value={o.value} style={{ fontFamily: o.value ? `"${o.value}", "Space Grotesk", sans-serif` : `"Space Grotesk", sans-serif` }}>{o.label}</option>)}
          </select>
        </label>

        <Slider label={t("text.letterSpacing")} name="letterSpacing" value={form.letterSpacing} min="-2" max="20" step="0.5" unit="px" onChange={onChange} />
        <SelectField label={t("text.alignment")} name="titleAlign" value={form.titleAlign} onChange={onChange}>
          <option value="left">{t("text.left")}</option>
          <option value="center">{t("text.center")}</option>
          <option value="right">{t("text.right")}</option>
        </SelectField>
      </section>

      <section className="panel-block">
        <p className="section-summary-label">{t("layout.posterSize")}</p>
        <div className="shape-picker">
          {SHAPES.map(s => (
            <button key={s} type="button" className={`shape-btn${form.mapShape === s ? " active" : ""}`} onClick={() => onChange({ target: { name: "mapShape", value: s } })} title={s.charAt(0).toUpperCase() + s.slice(1)}>
              <span className={`shape-icon shape-icon--${s}`} />
            </button>
          ))}
        </div>

        <section className="panel-block" style={{ marginTop: 24 }}>
          <p className="section-summary-label">{t("poster.logo")}</p>
          <LogoUploadField form={form} />
        </section>

        {form.layoutMode === "dual-city" ? (
          <p className="section-summary-label" style={{ color: "#94A3B8", textAlign: "center", padding: "12px 0" }}>{t("dualCity.activeHint")}</p>
        ) : (
          <SelectField label={t("text.layoutMode")} name="layoutMode" value={form.layoutMode} onChange={onChange}>
            <option value="poster">{t("layout.standardPoster")}</option>
            <option value="property-card">{t("layout.propertyCard")}</option>
            <option value="shop-signage">{t("layout.shopSignage")}</option>
          </SelectField>
        )}

        {form.layoutMode === "property-card" && (
          <section className="panel-block" style={{ marginTop: 12 }}>
            <p className="section-summary-label">{t("property.details")}</p>
            <SelectField label={t("property.status")} name="propStatus" value={form.propStatus} onChange={onChange}>
              <option value="For Sale">{t("property.forSale")}</option>
              <option value="For Rent">{t("property.forRent")}</option>
              <option value="Sold">{t("property.sold")}</option>
              <option value="Auction">{t("property.auction")}</option>
            </SelectField>
            <div className="field-grid">
              <Field label={t("property.type")} name="propType" value={form.propType} onChange={onChange} />
              <Field label={t("property.price")} name="propPrice" value={form.propPrice} onChange={onChange} />
              <Field label={t("property.landSize")} name="propLandSize" value={form.propLandSize} onChange={onChange} />
              <Field label={t("property.buildSize")} name="propBuildSize" value={form.propBuildSize} onChange={onChange} />
              <Field label={t("property.bedrooms")} name="propBedrooms" value={form.propBedrooms} onChange={onChange} type="number" />
              <Field label={t("property.bathrooms")} name="propBathrooms" value={form.propBathrooms} onChange={onChange} type="number" />
            </div>
            <Field label={t("property.features")} name="propFeatures" value={form.propFeatures} onChange={onChange} />
            <Field label={t("property.contactNumber")} name="propContact" value={form.propContact} onChange={onChange} />
            <Field label={t("property.agentName")} name="propAgent" value={form.propAgent} onChange={onChange} />
            <Field label={t("property.ctaText")} name="propCta" value={form.propCta} onChange={onChange} />
            <Field label={t("property.website")} name="propWebsite" value={form.propWebsite} onChange={onChange} placeholder="https://..." />
          </section>
        )}

        {form.layoutMode === "shop-signage" && (
          <section className="panel-block" style={{ marginTop: 12 }}>
            <p className="section-summary-label">{t("shop.details")}</p>
            <Field label={t("shop.openingHours")} name="shopOpen" value={form.shopOpen} onChange={onChange} />
            <Field label={t("shop.tagline")} name="shopTagline" value={form.shopTagline} onChange={onChange} />
            <Field label={t("shop.phone")} name="shopPhone" value={form.shopPhone} onChange={onChange} />
            <div className="field-grid">
              <Field label={t("shop.instagram")} name="shopInstagram" value={form.shopInstagram} onChange={onChange} placeholder="@handle" />
              <Field label={t("shop.facebook")} name="shopFacebook" value={form.shopFacebook} onChange={onChange} placeholder="url" />
              <Field label={t("shop.telegram")} name="shopTelegram" value={form.shopTelegram} onChange={onChange} placeholder="@username" />
              <Field label={t("shop.whatsapp")} name="shopWhatsapp" value={form.shopWhatsapp} onChange={onChange} placeholder="+855..." />
            </div>
          </section>
        )}

        <SelectField label={t("poster.footerStyle")} name="footerStyle" value={form.footerStyle} onChange={onChange}>
          <option value="solid">{t("layout.solid")}</option>
          <option value="gradient">{t("layout.gradient")}</option>
          <option value="none">{t("layout.none")}</option>
        </SelectField>

        <Toggle label={t("layout.decorativeBorder")} name="showBorder" checked={Boolean(form.showBorder)} onChange={onChange} />
        <Toggle label={t("poster.showCoordinates")} name="showCoordinates" checked={Boolean(form.showCoordinates)} onChange={onChange} />
        {form.showCoordinates && (
          <SelectField label={t("coords.format")} name="coordsFormat" value={form.coordsFormat} onChange={onChange}>
            <option value="decimal">{t("coords.decimal")}</option>
            <option value="dms">{t("coords.dms")}</option>
          </SelectField>
        )}
        <Toggle label={t("poster.allCaps")} name="titleAllCaps" checked={Boolean(form.titleAllCaps)} onChange={onChange} />
      </section>

      <section className="panel-block">
        <p className="section-summary-label">{t("radius.highlight" as any)}</p>
        <Slider label={t("radius.distance" as any)} name="radiusMeters" value={form.radiusMeters} min="0" max="5000" step="50" unit="m" onChange={onChange} />
        <Field label={t("radius.label" as any)} name="radiusLabel" value={form.radiusLabel} onChange={onChange} />
        <SelectField label={t("radius.style" as any)} name="radiusStyle" value={form.radiusStyle} onChange={onChange}>
          <option value="dashed">{t("radius.dashed" as any)}</option>
          <option value="filled">{t("radius.filled" as any)}</option>
          <option value="gradient">{t("radius.gradient" as any)}</option>
        </SelectField>
      </section>

      <section className="panel-block">
        <p className="section-summary-label">{t("poi.nearby" as any)}</p>
        <Toggle label={t("poi.show" as any)} name="showPois" checked={Boolean(form.showPois)} onChange={onChange} />
        {form.showPois && (
          <>
            {[["poiSchools", "poi.schools"], ["poiHospitals", "poi.hospitals"], ["poiMarkets", "poi.markets"], ["poiBanks", "poi.banks"], ["poiRestaurants", "poi.restaurants"]].map(([name, key]) => (
              <Toggle key={name} label={t(key as any)} name={name} checked={Boolean(form[name as keyof PosterForm])} onChange={onChange} />
            ))}
          </>
        )}
      </section>

      <QRSection form={form} onChange={onChange} />
      <EmbedWidgetSection form={form} />
    </>
  );
}

function QRSection({ form, onChange }: { form: PosterForm; onChange: (e: any) => void }) {
  const { dispatch } = usePosterContext();
  const { t } = useI18n();

  const handleShare = useCallback(async () => {
    const lat = Number(form.latitude) || 0, lon = Number(form.longitude) || 0;
    const urls: Record<string, string> = { "google-maps": buildGoogleMapsUrl(lat, lon), "apple-maps": buildAppleMapsUrl(lat, lon), "whatsapp": form.qrPhone ? buildWhatsAppUrl(form.qrPhone) : "", "telegram": form.qrPhone ? buildTelegramUrl(form.qrPhone) : "", "teetang-landing": buildTeeTangUrl(lat, lon, form.displayCity), "custom": form.qrCustomUrl || "" };
    const url = urls[form.qrDestination] ?? buildGoogleMapsUrl(lat, lon);
    if (!url) return;
    try {
      if ("share" in navigator) await (navigator as any).share({ title: "Map location", text: url, url });
      else await (navigator as any).clipboard.writeText(url);
    } catch {}
  }, [form]);

  const setXY = (field: string, v: number) => dispatch({ type: "SET_FORM_FIELDS", fields: { [field]: String(v), qrPosition: "custom" } });

  return (
    <section className="panel-block">
      <p className="section-summary-label">{t("layout.qrCode")}</p>
      <Toggle label={t("layout.qrCode")} name="showQrCode" checked={Boolean(form.showQrCode)} onChange={onChange} />
      {form.showQrCode && (
        <>
          <SelectField label={t("qr.destination")} name="qrDestination" value={form.qrDestination} onChange={onChange}>
            <option value="google-maps">Google Maps</option>
            <option value="apple-maps">Apple Maps</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="telegram">Telegram</option>
            <option value="teetang-landing">Tee Tang Landing</option>
            <option value="custom">{t("qr.customUrl")}</option>
          </SelectField>
          {form.qrDestination === "custom" && <Field label={t("qr.customUrl")} name="qrCustomUrl" value={form.qrCustomUrl} onChange={onChange} placeholder="https://..." />}
          {(form.qrDestination === "whatsapp" || form.qrDestination === "telegram") && <Field label={t("qr.phoneUsername")} name="qrPhone" value={form.qrPhone} onChange={onChange} placeholder={form.qrDestination === "whatsapp" ? "+855..." : "@username"} />}

          <SelectField label={t("qr.position")} name="qrPosition" value={form.qrPosition} onChange={e => { const v = e.target.value; dispatch({ type: "SET_FORM_FIELDS", fields: v === "custom" ? { qrPosition: v } : { qrPosition: v, qrX: "", qrY: "" } }); }}>
            {[["bottom-right","Bottom Right"],["bottom-left","Bottom Left"],["top-right","Top Right"],["top-left","Top Left"],["center",t("text.center")],["custom","Custom"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </SelectField>

          {[["X","qrX",92],["Y","qrY",92]].map(([lbl,key,def]) => (
            <div key={key as string}>
              <div className="ctrl-row"><span className="ctrl-label">{lbl}</span><span className="ctrl-val">{form[key as keyof PosterForm] ? `${form[key as keyof PosterForm]}%` : `${def}%`}</span></div>
              <input type="range" className="ref-slider" min="0" max="100" step="0.5" value={form[key as keyof PosterForm] !== "" && form[key as keyof PosterForm] !== undefined ? Number(form[key as keyof PosterForm]) : def as number} onChange={e => setXY(key as string, Number(e.target.value))} />
            </div>
          ))}
          <Slider label={t("poster.size")} name="qrSize" value={form.qrSize} min="5" max="40" step="1" unit="cq" onChange={onChange} />
          <Slider label={t("poster.opacity")} name="qrOpacity" value={form.qrOpacity} min="10" max="100" step="5" unit="%" onChange={onChange} />
          <label style={{ marginTop: 12 }}>{t("qr.padding")}<input type="number" className="form-control-tall" name="qrPadding" value={form.qrPadding} onChange={onChange} /></label>
          <label style={{ marginTop: 12 }}>{t("qr.label")}<input className="form-control-tall" name="qrLabel" value={form.qrLabel} onChange={onChange} placeholder="Scan to navigate" /></label>
          <button type="button" className="general-header-text-btn" style={{ width: "100%", justifyContent: "center", marginTop: 12 }} onClick={handleShare}>{t("qr.share")}</button>
        </>
      )}
    </section>
  );
}

function EmbedWidgetSection({ form }: { form: PosterForm }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const lat = Number(form.latitude) || 0, lon = Number(form.longitude) || 0;
  const city = encodeURIComponent(form.displayCity || form.location || "location");
  const code = `<iframe\n  src="https://teetangart.com/embed?lat=${lat}&lon=${lon}&city=${city}&theme=${form.theme}"\n  width="400" height="500"\n  frameborder="0"\n  style="border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15);"\n></iframe>`;
  return (
    <section className="panel-block">
      <p className="section-summary-label">{t("embed.widget")}</p>
      <p style={{ fontSize: "0.7rem", color: "#94A3B8", margin: "0 0 8px" }}>Copy this code to embed the poster on any website.</p>
      <pre style={{ fontSize: "0.6rem", background: "rgba(255,255,255,0.04)", padding: 10, borderRadius: 8, overflow: "auto", maxHeight: 100, color: "#CBD5E1", margin: "0 0 8px" }}>{code}</pre>
      <button type="button" className="general-header-text-btn" style={{ width: "100%", justifyContent: "center" }} onClick={() => void navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}>
        {copied ? t("embed.copied") : t("embed.copyCode")}
      </button>
    </section>
  );
}
