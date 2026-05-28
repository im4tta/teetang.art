import type { ResolvedTheme } from "@/features/theme/domain/types";
import type {
  MarkerIconDefinition,
  MarkerItem,
  MarkerProjectionInput,
} from "@/features/markers/domain/types";
import type { Route } from "@/features/routes/domain/types";
import type { PosterShape } from "@/features/poster/domain/clipShapes";

export interface CanvasSize {
  width: number;
  height: number;
  requestedWidth: number;
  requestedHeight: number;
  downscaleFactor: number;
}

/** Options passed to the export compositor (map snapshot + text overlay). */
export interface ExportOptions {
  theme: ResolvedTheme;
  center: { lat: number; lon: number };
  widthInches: number;
  heightInches: number;
  displayCity: string;
  displayCountry: string;
  displayContinent?: string;
  fontFamily: string;
  showPosterText: boolean;
  showOverlay?: boolean;
  includeCredits?: boolean;
  markers?: MarkerItem[];
  markerIcons?: MarkerIconDefinition[];
  markerProjection?: MarkerProjectionInput;
  markerScaleX?: number;
  markerScaleY?: number;
  markerSizeScale?: number;
  routes?: Route[];
  mapShape?: PosterShape;
  showQrCode?: boolean;
  qrUrl?: string;
  qrPosition?: string;
  qrSize?: string;
  qrOpacity?: string;
  qrPadding?: string;
  logoUrl?: string;
  logoPosition?: string;
  logoSize?: string;
  logoOpacity?: string;
  logoPadding?: string;
  qrX?: string;
  qrY?: string;
  logoX?: string;
  logoY?: string;
  qrLabel?: string;
  letterSpacing?: string;
  titleAlign?: string;
  showUnderline?: boolean;
  coordsFormat?: string;
  showBorder?: boolean;
}

export interface Typography {
  displayCity: string;
  displayCountry: string;
  displayContinent?: string;
  fontFamily: string;
  showPosterText: boolean;
  includeCredits?: boolean;
}
