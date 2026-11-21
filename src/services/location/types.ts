export interface Location {
  id: string;
  label: string;
  shortLabel: string;
  city: string;
  country: string;
  countryCode?: string;
  continent?: string;
  placeType?: string;
  /** The place's Khmer name, when OpenStreetMap has one. */
  nameKm?: string;
  lat: number;
  lon: number;
}

export type SearchResult = Location;
