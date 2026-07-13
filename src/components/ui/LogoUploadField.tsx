import { useRef, useState } from "react";
import { useI18n } from "@/context/i18n/context";
import { usePosterContext } from "@/context/PosterContext";

export function LogoUploadField({ form }: { form: any }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();
  const { dispatch } = usePosterContext();
  const [show, setShow] = useState(Boolean(form.logoUrl));

  const setField = (fields: Record<string, string>) => dispatch({ type: "SET_FORM_FIELDS", fields });

  return (
    <>
      <div className="ios-toggle-row">
        <span className="ios-toggle-label">Show logo</span>
        <label className="ios-toggle">
          <input type="checkbox" checked={show} onChange={e => { setShow(e.target.checked); if (!e.target.checked) dispatch({ type: "SET_FIELD", name: "logoUrl", value: "" }); }} />
          <span className="ios-track" />
        </label>
      </div>
      {show && (
        <>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml" style={{ display: "none" }} onChange={e => {
            const file = e.target.files?.[0]; if (!file) return;
            const r = new FileReader(); r.onload = ev => dispatch({ type: "SET_FIELD", name: "logoUrl", value: String(ev.target?.result ?? "") }); r.readAsDataURL(file);
          }} />
          <button type="button" className="general-header-text-btn" style={{ marginTop: 8, width: "100%" }} onClick={() => fileRef.current?.click()}>{form.logoUrl ? "Change logo" : "Upload logo"}</button>
          {form.logoUrl && <img src={form.logoUrl} alt="Logo preview" style={{ maxWidth: 120, maxHeight: 60, marginTop: 8, display: "block" }} />}
          {form.logoUrl && (
            <>
              <label className="toggle-field" style={{ marginTop: 8 }}>
                <span>{t("poster.position")}</span>
                <span className="theme-select-wrapper">
                  <select className="theme-select" value={form.logoPosition} onChange={e => { const v = e.target.value; setField(v === "custom" ? { logoPosition: v } : { logoPosition: v, logoX: "", logoY: "" }); }}>
                    {[["bottom-right","Bottom Right"],["bottom-left","Bottom Left"],["top-right","Top Right"],["top-left","Top Left"],["center","Center"],["custom","Custom"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </span>
              </label>
              {[["X", "logoX", 92], ["Y", "logoY", 92]].map(([lbl, key, def]) => (
                <div key={key as string}><div className="ctrl-row"><span className="ctrl-label">{lbl}</span><span className="ctrl-val">{form[key as string] !== "" && form[key as string] !== undefined ? `${form[key as string]}%` : `${def}%`}</span></div>
                  <input type="range" className="ref-slider" min="0" max="100" step="0.5" value={form[key as string] !== "" && form[key as string] !== undefined ? Number(form[key as string]) : def} onChange={e => setField({ [key as string]: String(Number(e.target.value)), logoPosition: "custom" })} /></div>
              ))}
              {[["poster.size", "logoSize", 5, 80, 1, "%"], ["poster.opacity", "logoOpacity", 10, 100, 5, "%"]].map(([lk, fk, min, max, step, unit]) => (
                <div key={fk as string}><div className="ctrl-row"><span className="ctrl-label">{t(lk as any)}</span><span className="ctrl-val">{form[fk as string]}{unit}</span></div>
                  <input type="range" className="ref-slider" min={min} max={max} step={step} value={Number(form[fk as string])} onChange={e => setField({ [fk as string]: String(Number(e.target.value)) })} /></div>
              ))}
              <label style={{ marginTop: 12 }}>{t("poster.padding")} (px)<input type="number" className="form-control-tall" value={form.logoPadding} onChange={e => setField({ logoPadding: e.target.value })} /></label>
            </>
          )}
        </>
      )}
    </>
  );
}
