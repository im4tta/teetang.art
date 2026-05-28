export interface Location {
  id: string;
  label: string;
  shortLabel: string;
  city: string;
  country: string;
  countryCode?: string;
  continent?: string;
  placeType?: string;
  lat: number;
  lon: number;
}

export interface SearchResult extends Location {}

/** Place types that represent actual settlements */
export const SETTLEMENT_TYPES = new Set([
  "city",
  "town",
  "village",
  "hamlet",
  "municipality",
  "locality",
]);
