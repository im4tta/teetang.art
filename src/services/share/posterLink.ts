import type { PosterForm } from "@/context/posterReducer";
import { FONT_OPTIONS, MAX_DISTANCE_METERS, MIN_DISTANCE_METERS } from "@/services/config";
import { POSTER_SHAPES } from "@/services/poster/clipShapes";
import { themeOptions } from "@/services/theme/themeRepository";
import { layoutOptions } from "@/services/layout/layoutRepository";
import { clamp } from "@/utils/geo/math";
import {
  buildAppleMapsUrl,
  buildGoogleMapsUrl,
  buildTelegramUrl,
  buildWhatsAppUrl,
} from "@/utils/qrCode";

export const SITE_URL = "https://teetang.art";

/** Short query names a shared `/create` link uses for each poster field. */
const LINK_FIELDS = {
  lat: "latitude",
  lon: "longitude",
  dist: "distance",
  theme: "theme",
  layout: "layout",
  shape: "mapShape",
  font: "fontFamily",
  city: "displayCity",
  country: "displayCountry",
} as const satisfies Record<string, keyof PosterForm>;

/** A teetang.art link that reopens the editor with this poster's design. */
export function buildPosterLink(form: PosterForm): string {
  const params = new URLSearchParams();
  for (const [param, field] of Object.entries(LINK_FIELDS)) {
    const value = String(form[field] ?? "").trim();
    if (value) params.set(param, value);
  }
  return `${SITE_URL}/create?${params}`;
}

export interface PosterLinkRequest {
  /** Validated form fields to apply directly. */
  fields: Partial<PosterForm>;
  theme?: string;
  layout?: string;
  /** Place name to geocode when the link carries no coordinates. */
  geocodeQuery?: string;
}

const isKnown = (value: string, allowed: readonly string[]) =>
  value !== "" && allowed.includes(value);

/**
 * Reads a `/create?…` query string. Unknown or malformed values are ignored so a
 * hand-edited link can never put the editor into an invalid state.
 */
export function parsePosterLink(params: URLSearchParams): PosterLinkRequest | null {
  const get = (key: keyof typeof LINK_FIELDS) => params.get(key)?.trim() ?? "";
  const fields: Partial<PosterForm> = {};

  const lat = Number(get("lat"));
  const lon = Number(get("lon"));
  const hasCoords =
    get("lat") !== "" && get("lon") !== "" && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  if (hasCoords) {
    fields.latitude = lat.toFixed(6);
    fields.longitude = lon.toFixed(6);
  }

  const dist = Number(get("dist"));
  if (get("dist") && Number.isFinite(dist)) {
    fields.distance = String(Math.round(clamp(dist, MIN_DISTANCE_METERS, MAX_DISTANCE_METERS)));
  }
  if (isKnown(get("shape"), POSTER_SHAPES)) fields.mapShape = get("shape");
  if (
    isKnown(
      get("font"),
      FONT_OPTIONS.map((o) => o.value),
    )
  )
    fields.fontFamily = get("font");

  const city = get("city").slice(0, 80);
  const country = get("country").slice(0, 80);
  if (hasCoords) {
    Object.assign(fields, {
      location:
        [city, country].filter(Boolean).join(", ") || `${fields.latitude}, ${fields.longitude}`,
      displayCity: city,
      displayCountry: country,
      footerCity: city,
      footerCountry: country,
    });
  }

  const theme = isKnown(
    get("theme"),
    themeOptions.map((o) => o.id),
  )
    ? get("theme")
    : undefined;
  const layout = isKnown(
    get("layout"),
    layoutOptions.map((o) => o.id),
  )
    ? get("layout")
    : undefined;
  const geocodeQuery = !hasCoords && city ? city : undefined;

  if (!Object.keys(fields).length && !theme && !layout && !geocodeQuery) return null;
  return { fields, theme, layout, geocodeQuery };
}

/** True when the page was opened from a link that chooses the poster's place. */
export function linkSetsLocation(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has("city") || (params.has("lat") && params.has("lon"));
}

/** Where the poster's QR code points, or "" when the chosen target is incomplete. */
export function resolveQrTarget(form: PosterForm): string {
  const lat = Number(form.latitude) || 0;
  const lon = Number(form.longitude) || 0;
  switch (form.qrDestination) {
    case "custom":
      return form.qrCustomUrl.trim();
    case "whatsapp":
      return form.qrPhone ? buildWhatsAppUrl(form.qrPhone) : "";
    case "telegram":
      return form.qrPhone ? buildTelegramUrl(form.qrPhone) : "";
    case "apple-maps":
      return buildAppleMapsUrl(lat, lon);
    case "teetang-landing":
      return buildPosterLink(form);
    default:
      return buildGoogleMapsUrl(lat, lon);
  }
}

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

/** Opens the native share sheet when there is one, otherwise copies the link. */
export async function shareOrCopy(data: ShareData): Promise<ShareOutcome> {
  if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  return copyText(data.url ?? data.text ?? "");
}

export async function copyText(text: string): Promise<ShareOutcome> {
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
