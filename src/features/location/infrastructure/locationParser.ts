import type { Location, SearchResult } from "../domain/types";

interface NominatimEntry {
  lat?: number | string;
  lon?: number | string;
  display_name?: string;
  label?: string;
  place_id?: number | string;
  city?: string;
  country?: string;
  type?: string;
  address?: Record<string, string>;
}

const ADMIN_KEYWORDS = [
  "khan",
  "district",
  "quận",
  "quan",
  "huyện",
  "huyen",
  "phường",
  "phuong",
  "郡",
  "区",
  "구",
];

function isAdminArea(name: string): boolean {
  const lower = name.toLowerCase();
  for (const kw of ADMIN_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }
  return false;
}

/** Prefer place types that represent actual settlements over administrative divisions */
const PREFERRED_TYPES = new Set(["city", "town", "village", "hamlet", "municipality", "locality"]);

function inferContinentFromCoordinates(lat: number, lon: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "";
  if (lat <= -60) return "Antarctica";
  if (lat >= 5 && lat <= 82 && lon >= -170 && lon <= -20) return "North America";
  if (lat <= 15 && lat >= -60 && lon >= -92 && lon <= -30) return "South America";
  if (lat >= 35 && lon >= -25 && lon <= 60) return "Europe";
  if (lat >= -35 && lat <= 37 && lon >= -20 && lon <= 55) return "Africa";
  if (lat >= -10 && lon >= 110 && lon <= 180) return "Oceania";
  if (lat >= -50 && lon >= 110 && lon <= 180) return "Oceania";
  if (lon >= 25 && lon <= 180) return "Asia";
  return "";
}

function pickFirstAddressValue(address: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = address[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function normalizeLocationResult(
  entry: NominatimEntry | null | undefined,
  fallbackLabel = "",
): SearchResult | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const lat = Number(entry.lat);
  const lon = Number(entry.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const label = String(entry.display_name ?? entry.label ?? fallbackLabel).trim();
  if (!label) {
    return null;
  }

  // Extract the first part of display_name as the short label (e.g., "Angkor Wat")
  const shortLabel = label.split(",")[0]?.trim() || label;

  const address = entry.address ?? {};

  // Check all address values for a settlement name, preferring non-admin areas
  const cityPriorityKeys = [
    "city",
    "town",
    "village",
    "hamlet",
    "municipality",
    "state",
    "province",
    "region",
    "county",
    "city_district",
    "suburb",
    "state_district",
  ];
  let city = "";
  for (const key of cityPriorityKeys) {
    const value = address[key];
    if (typeof value === "string" && value.trim()) {
      const trimmed = value.trim();
      if (!isAdminArea(trimmed)) {
        city = trimmed;
        break;
      }
      if (!city) city = trimmed;
    }
  }
  if (!city) city = String(entry.city ?? "").trim();

  const country = pickFirstAddressValue(address, ["country"]) || String(entry.country ?? "").trim();
  const countryCode = pickFirstAddressValue(address, ["country_code"]).toUpperCase();

  // Determine continent from the result's `type` field or fallback to coordinates
  const resultType = String(entry.type ?? "").toLowerCase();
  const continent = PREFERRED_TYPES.has(resultType)
    ? inferContinentFromCoordinates(lat, lon)
    : pickFirstAddressValue(address, ["continent"]) || inferContinentFromCoordinates(lat, lon);

  return {
    id: String(entry.place_id ?? label),
    label,
    shortLabel,
    city,
    country,
    countryCode,
    continent,
    placeType: resultType || undefined,
    lat,
    lon,
  };
}

export function parseLocationResponseItems(payload: unknown): SearchResult[] {
  const entries = Array.isArray(payload) ? (payload as NominatimEntry[]) : [];
  const suggestions: SearchResult[] = [];
  const seenLabels = new Set<string>();

  for (const entry of entries) {
    const normalized = normalizeLocationResult(entry);
    if (!normalized) {
      continue;
    }

    const labelKey = normalized.label.toLowerCase();
    if (seenLabels.has(labelKey)) {
      continue;
    }

    seenLabels.add(labelKey);
    suggestions.push(normalized);
  }

  return suggestions;
}
