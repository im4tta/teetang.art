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
export const setGeocodeLanguage = nominatim.setLanguage;

/* ── Fonts ── */

export const ensureGoogleFont = googleFontsAdapter.ensureFont.bind(googleFontsAdapter);

/* ── Poster compositing ── */

export { compositeExport } from "@/services/poster/renderer";

/* ── Export helpers ── */

export { captureMapAsCanvas } from "@/services/export/mapExporter";

export { createPngBlob } from "@/services/export/pngExporter";
export { createLayeredSvgBlobFromMap } from "@/services/export/layeredSvgExporter";

export { createPdfBlobFromCanvas } from "@/services/export/pdfExporter";

export { createPosterFilename } from "@/services/export/filenameGenerator";

export { triggerDownloadBlob } from "@/services/export/fileDownloader";

/* ── Routes ── */

export { drawRoutesOnCanvas } from "@/services/routes/rendering";
