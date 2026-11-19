import type { PlatePlace } from "./plateSettings";

export interface SurprisePlace extends PlatePlace {
  lat: number;
  lon: number;
  sizeKm: number;
}

const place = (
  name: string,
  region: string,
  country: string,
  countryCode: string,
  lat: number,
  lon: number,
  sizeKm: number,
): SurprisePlace => ({ name, region, country, countryCode, lat, lon, sizeKm });

/** Landscapes that make striking plates; Cambodia first, then the world. */
export const SURPRISE_PLACES: SurprisePlace[] = [
  place("Phnom Aural", "Kampong Speu", "Cambodia", "KH", 12.0333, 104.1667, 10),
  place("Bokor Mountain", "Kampot", "Cambodia", "KH", 10.62, 104.02, 14),
  place("Phnom Kulen", "Siem Reap", "Cambodia", "KH", 13.565, 104.1, 16),
  place("Angkor Wat", "Siem Reap", "Cambodia", "KH", 13.4125, 103.867, 10),
  place("Preah Vihear Temple", "Preah Vihear", "Cambodia", "KH", 14.3906, 104.6797, 8),
  place("Phnom Samkos", "Pursat", "Cambodia", "KH", 12.1667, 102.9667, 16),
  place("Kep", "Kep", "Cambodia", "KH", 10.483, 104.317, 8),
  place("Mount Everest", "Khumbu", "Nepal", "NP", 27.9881, 86.925, 16),
  place("Mount Fuji", "Shizuoka", "Japan", "JP", 35.3606, 138.7274, 22),
  place("Grand Canyon", "Arizona", "United States", "US", 36.1069, -112.1129, 20),
  place("Matterhorn", "Valais", "Switzerland", "CH", 45.9763, 7.6586, 10),
  place("Kilimanjaro", "Kilimanjaro", "Tanzania", "TZ", -3.0674, 37.3556, 30),
  place("Table Mountain", "Western Cape", "South Africa", "ZA", -33.9628, 18.4098, 8),
  place("Mount St. Helens", "Washington", "United States", "US", 46.1912, -122.1944, 12),
  place("Yosemite Valley", "California", "United States", "US", 37.7456, -119.5936, 12),
  place("Crater Lake", "Oregon", "United States", "US", 42.9446, -122.109, 16),
  place("Mount Kinabalu", "Sabah", "Malaysia", "MY", 6.0753, 116.5583, 14),
  place("Mount Bromo", "East Java", "Indonesia", "ID", -7.9425, 112.953, 12),
  place("Tongariro", "Manawatū-Whanganui", "New Zealand", "NZ", -39.13, 175.64, 22),
  place("Mount Etna", "Sicily", "Italy", "IT", 37.751, 14.9934, 26),
  place("Santorini", "South Aegean", "Greece", "GR", 36.4, 25.43, 20),
  place("Uluru", "Northern Territory", "Australia", "AU", -25.3444, 131.0369, 8),
];

export function pickSurprise(currentName: string): SurprisePlace {
  const options = SURPRISE_PLACES.filter((p) => p.name !== currentName);
  return options[Math.floor(Math.random() * options.length)];
}
