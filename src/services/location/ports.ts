import type { Location } from "@/services/location/types";

export interface IGeocodePort {
  searchLocations(query: string, limit?: number, signal?: AbortSignal): Promise<Location[]>;
  geocodeLocation(query: string): Promise<Location>;
  reverseGeocode(lat: number, lon: number): Promise<Location>;
}
