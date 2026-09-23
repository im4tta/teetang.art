/**
 * Pre-instantiated infrastructure services.
 *
 * This module creates singleton instances of the hexagonal adapters,
 * wiring them to the concrete cache and HTTP implementations.
 * Application hooks import from here instead of calling factories directly.
 */

import { localStorageCache } from "@/services/cache/localStorageCache";
import { fetchAdapter } from "@/api/http/fetchAdapter";
import { googleFontsAdapter } from "@/api/fonts/googleFontsAdapter";
import { createNominatimAdapter } from "@/api/nominatimAdapter";

/* ── Location / Geocoding ── */

const nominatim = createNominatimAdapter(fetchAdapter, localStorageCache);

export const searchLocations = nominatim.searchLocations;
export const geocodeLocation = nominatim.geocodeLocation;
export const reverseGeocodeCoordinates = nominatim.reverseGeocode;

/* ── Fonts ── */

export const ensureGoogleFont = googleFontsAdapter.ensureFont.bind(googleFontsAdapter);
