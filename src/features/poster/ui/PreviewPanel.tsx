import {
  useCallback,
  useEffect,
  useRef,
  useState,
  lazy,
  Suspense,
  type CSSProperties,
} from "react";
import { useMobileViewport } from "@/shared/hooks/useMobileViewport";
import { usePosterContext } from "./PosterContext";
import {
  useMapSync,
  distanceToZoom,
  resolveZoomBounds,
  zoomToDistance,
} from "@/features/map/application/useMapSync";
import MapPreview from "@/features/map/ui/MapPreview";
import MarkerOverlay from "@/features/markers/ui/MarkerOverlay";
import RouteOverlay from "@/features/routes/ui/RouteOverlay";
import RouteEndpointsOverlay from "@/features/routes/ui/RouteEndpointsOverlay";
import PoiOverlay from "@/features/map/ui/PoiOverlay";
import GradientFades from "./GradientFades";
import PosterTextOverlay from "./PosterTextOverlay";
import DualPosterTextOverlay from "./DualPosterTextOverlay";
import PosterMediaOverlay from "./PosterMediaOverlay";
import { clamp } from "@/shared/geo/math";
import { getContrastBorderColor } from "@/shared/utils/color";
import type { PosterShape } from "@/features/poster/domain/clipShapes";
import UserGuide from "@/shared/ui/UserGuide";
import PickerModal from "@/shared/ui/PickerModal";
import { useI18n } from "@/shared/i18n/context";
const ExportFab = lazy(() => import("@/features/export/ui/ExportFab"));
import MapPrimaryControls from "./MapPrimaryControls";
import { InfoIcon } from "@/shared/ui/Icons";
import {
  DEFAULT_POSTER_WIDTH_CM,
  DEFAULT_POSTER_HEIGHT_CM,
  DEFAULT_DISTANCE_METERS,
} from "@/core/config";
import { ensureGoogleFont, reverseGeocodeCoordinates } from "@/core/services";
import {
  buildGoogleMapsUrl,
  buildWhatsAppUrl,
  buildAppleMapsUrl,
  buildTelegramUrl,
  buildTeeTangUrl,
  getQrCodeDataUrl,
} from "@/shared/utils/qrCode";
import {
  createCustomLayoutOption,
  formatLayoutDimensions,
  getLayoutOption,
} from "@/features/layout/infrastructure/layoutRepository";
import { themeOptions } from "@/features/theme/infrastructure/themeRepository";
import { useSwipeGestures } from "@/shared/hooks/useSwipeGestures";
import PosterInfoBadge from "./PosterInfoBadge";
import SwipeHintOverlay from "./SwipeHintOverlay";
import { PropertyCardOverlay, ShopSignageOverlay } from "./PosterLayoutOverlays";
import PosterFooterBar from "./PosterFooterBar";
import { useRouteInteractions } from "@/features/poster/application/hooks/useRouteInteractions";
import { useMapBearing } from "@/features/poster/application/hooks/useMapBearing";
import { useMapRecenter } from "@/features/poster/application/hooks/useMapRecenter";

const LOCKED_HINT = "Map is locked to prevent unintended movement.";
const UNLOCK_HINT = `${LOCKED_HINT}\nClick to unlock map editing.`;
const RECENTER_HINT = "Recenter map to the current location";
const COUNTRY_VIEW_ZOOM = 10;
const CONTINENT_VIEW_ZOOM = 6;
const SHAPES = [
  "rectangle",
  "rounded",
  "circle",
  "diamond",
  "hexagon",
  "star",
  "triangle",
  "heart",
];

function buildQrData(form: any): string {
  const lat = Number(form.latitude) || 0,
    lon = Number(form.longitude) || 0;
  switch (form.qrDestination) {
    case "custom":
      return String(form.qrCustomUrl || "").trim();
    case "whatsapp":
      return buildWhatsAppUrl(form.qrPhone || "");
    case "telegram":
      return buildTelegramUrl(form.qrPhone || "");
    case "apple-maps":
      return buildAppleMapsUrl(lat, lon);
    case "teetang-landing":
      return buildTeeTangUrl(lat, lon, form.displayCity);
    default:
      return buildGoogleMapsUrl(lat, lon);
  }
}

function getPois(form: any): string[] {
  return ["poiSchools", "poiHospitals", "poiMarkets", "poiBanks", "poiRestaurants"].filter(
    (k) => form[k],
  );
}

export default function PreviewPanel() {
  const { state, dispatch, effectiveTheme, effectiveTheme2, mapStyle, mapStyle2, mapRef, mapRef2 } =
    usePosterContext();
  const { t } = useI18n();
  const { form, selectedLocation, userLocation, isMarkerEditorActive, activeMarkerId } = state;
  const hasVisibleMarkers = form.showMarkers && state.markers.length > 0;
  const {
    mapCenter,
    mapZoom,
    mapMinZoom,
    mapMaxZoom,
    handleMove,
    handleMoveEnd,
    setContainerWidth,
    overzoomScale,
  } = useMapSync(state, dispatch, mapRef);

  const frameRef = useRef<HTMLDivElement | null>(null);
  const ghostCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const badgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isUserGuideOpen, setIsUserGuideOpen] = useState(false);
  const [qrPreviewUrl, setQrPreviewUrl] = useState("");
  const [badgeVisible, setBadgeVisible] = useState(true);
  const isMobileViewport = useMobileViewport();

  const isDualCity = form.layoutMode === "dual-city";
  const isPropertyCard = form.layoutMode === "property-card";
  const isShopSignage = form.layoutMode === "shop-signage";

  // ── Derived map2 values (needed by recenter + render) ──────────────────
  const formLat2 = Number(form.latitude2) || 0,
    formLon2 = Number(form.longitude2) || 0;
  const formDistance2 = Number(form.distance2) || DEFAULT_DISTANCE_METERS;
  const mapCenter2: [number, number] = [formLon2, formLat2];
  const halfContainerPx = Math.max(300, (frameRef.current?.getBoundingClientRect().width ?? 0) / 2);
  const mapZoom2 = clamp(
    distanceToZoom(formDistance2, formLat2, halfContainerPx),
    mapMinZoom,
    mapMaxZoom,
  );

  // ── Extracted hooks ────────────────────────────────────────────────────
  const {
    routeDrawOverlayRef,
    handleRouteEndpointDragEnd,
    handleViaPointDragEnd,
    handleViaPointDelete,
  } = useRouteInteractions({
    mapRef,
    routes: state.routes,
    snapToRoads: form.snapToRoads,
    routeDrawMode: state.routeDrawMode,
    routesLength: state.routes.length,
    dispatch,
  });

  const {
    mapBearing,
    isEditing,
    isRotationEnabled,
    handleStartEditing,
    handleFinishEditing,
    handleToggleRotation,
    handleRotateBy,
    handleBearingChange,
    handleCompassReset,
  } = useMapBearing({ mapRef, mapRef2, isDualCity, isMarkerEditorActive });

  const { handleRecenter } = useMapRecenter({
    mapRef,
    mapRef2,
    isDualCity,
    mapCenter2,
    mapZoom2,
    selectedLocation,
    userLocation,
    dispatch,
    onBearingReset: () => {}, // bearing reset already handled inside useMapBearing's handleCompassReset
  });

  // ── Ghost canvas sync ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const syncGhost = () => {
      const ghost = ghostCanvasRef.current,
        src = map.getCanvas();
      if (!ghost || !src) return;
      if (ghost.width !== src.width || ghost.height !== src.height) {
        ghost.width = src.width;
        ghost.height = src.height;
      }
      ghost.getContext("2d")?.drawImage(src, 0, 0);
    };
    map.on("render", syncGhost);
    return () => {
      map.off("render", syncGhost);
    };
  }, [mapRef]);

  // ── Badge timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isEditing) {
      setBadgeVisible(true);
      clearTimeout(badgeTimerRef.current!);
      return;
    }
    clearTimeout(badgeTimerRef.current!);
    badgeTimerRef.current = setTimeout(() => setBadgeVisible(false), 4000);
    return () => clearTimeout(badgeTimerRef.current!);
  }, [form.theme, form.mapShape, form.layoutMode, isMobileViewport, isEditing]);

  // ── Container width observer ───────────────────────────────────────────
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setContainerWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [setContainerWidth]);

  // ── Google font preload ────────────────────────────────────────────────
  useEffect(() => {
    const f = form.fontFamily.trim();
    if (f) void ensureGoogleFont(f).catch(() => {});
  }, [form.fontFamily]);

  // ── QR code preview ────────────────────────────────────────────────────
  useEffect(() => {
    if (!form.showQrCode) {
      setQrPreviewUrl("");
      return;
    }
    const data = buildQrData(form);
    if (!data) {
      setQrPreviewUrl("");
      return;
    }
    let alive = true;
    void getQrCodeDataUrl(data, 300).then((url) => {
      if (alive) setQrPreviewUrl(url);
    });
    return () => {
      alive = false;
    };
  }, [
    form.latitude,
    form.longitude,
    form.qrCustomUrl,
    form.qrDestination,
    form.qrPhone,
    form.showQrCode,
  ]);

  // ── handleMove2 / handleMoveEnd2 (dual-city second panel) ─────────────
  const handleMove2 = useCallback((_: [number, number], __: number) => {}, []);
  const handleMoveEnd2 = useCallback(
    (center: [number, number], zoom: number) => {
      const [lon, lat] = center;
      const hw = Math.max(300, (frameRef.current?.getBoundingClientRect().width ?? 0) / 2);
      const bounds = resolveZoomBounds(lat, hw);
      const dist = zoomToDistance(clamp(zoom, bounds.minZoom, bounds.maxZoom), lat, hw);
      dispatch({
        type: "SET_FORM_FIELDS",
        fields: {
          latitude2: lat.toFixed(6),
          longitude2: lon.toFixed(6),
          distance2: String(Math.round(dist)),
        },
      });
      void reverseGeocodeCoordinates(lat, lon)
        .then((r) => {
          const city = String(r.city ?? "").trim(),
            country = String(r.country ?? "").trim();
          if (city || country)
            dispatch({
              type: "SET_FORM_FIELDS",
              fields: {
                ...(city ? { displayCity2: city } : {}),
                ...(country ? { displayCountry2: country } : {}),
              },
            });
        })
        .catch(() => {});
    },
    [dispatch, frameRef],
  );

  // ── Marker interactions ────────────────────────────────────────────────
  const handleActiveMarkerChange = useCallback(
    (id: string | null) => dispatch({ type: "SET_ACTIVE_MARKER", markerId: id }),
    [dispatch],
  );
  const handleMarkerPositionChange = useCallback(
    (id: string, lat: number, lon: number) =>
      dispatch({ type: "UPDATE_MARKER", markerId: id, changes: { lat, lon } }),
    [dispatch],
  );
  const handleMarkerSizeChange = useCallback(
    (id: string, size: number) =>
      dispatch({ type: "UPDATE_MARKER", markerId: id, changes: { size } }),
    [dispatch],
  );

  // ── Derived display values ─────────────────────────────────────────────
  const widthCm = Number(form.width) || DEFAULT_POSTER_WIDTH_CM;
  const heightCm = Number(form.height) || DEFAULT_POSTER_HEIGHT_CM;
  const aspect = widthCm / heightCm;
  const formLat = Number(form.latitude) || 0,
    formLon = Number(form.longitude) || 0;
  const layoutOption = getLayoutOption(form.layout) ?? createCustomLayoutOption(widthCm, heightCm);
  const layoutLabel = `${layoutOption.name} (${formatLayoutDimensions(layoutOption)})`;
  const activePois = getPois(form);

  const isCityView = mapZoom >= COUNTRY_VIEW_ZOOM;
  const isCountryView = mapZoom >= CONTINENT_VIEW_ZOOM && !isCityView;
  const cityLabel = isCityView
    ? form.displayCity || form.location || "Phnom Penh"
    : isCountryView
      ? form.displayCountry || "Cambodia"
      : form.displayContinent || "Earth";
  const countryLabel = isCityView
    ? form.displayCountry || "Cambodia"
    : isCountryView
      ? form.displayContinent || "Asia"
      : "Earth";
  const footerCityLabel = form.footerCity || form.displayCity || form.location || "Phnom Penh";
  const footerCountryLabel = form.footerCountry || form.displayCountry || "Cambodia";

  const swipeHandlers = useSwipeGestures({
    onSwipeLeft: (startX?: number) => {
      const isRight = isDualCity && startX !== undefined && startX > window.innerWidth / 2;
      const key = isRight ? form.theme2 || form.theme : form.theme;
      const actionType = isRight ? "SET_THEME2" : "SET_THEME";
      const idx = themeOptions.findIndex((t) => t.id === key);
      const next = themeOptions[(idx + 1) % themeOptions.length];
      if (next) dispatch({ type: actionType, themeId: next.id });
    },
    onSwipeRight: (startX?: number) => {
      const isRight = isDualCity && startX !== undefined && startX > window.innerWidth / 2;
      const key = isRight ? form.theme2 || form.theme : form.theme;
      const actionType = isRight ? "SET_THEME2" : "SET_THEME";
      const idx = themeOptions.findIndex((t) => t.id === key);
      const next = themeOptions[(idx - 1 + themeOptions.length) % themeOptions.length];
      if (next) dispatch({ type: actionType, themeId: next.id });
    },
    onSwipeUp: () => {
      const idx = SHAPES.indexOf(form.mapShape);
      dispatch({ type: "SET_FIELD", name: "mapShape", value: SHAPES[(idx + 1) % SHAPES.length] });
    },
    onSwipeDown: () => {
      const idx = SHAPES.indexOf(form.mapShape);
      dispatch({
        type: "SET_FIELD",
        name: "mapShape",
        value: SHAPES[(idx - 1 + SHAPES.length) % SHAPES.length],
      });
    },
  });

  const commonMapProps = {
    interactive: (isEditing || state.routeDrawMode) && !isMarkerEditorActive,
    allowRotation: isEditing && isRotationEnabled,
    minZoom: mapMinZoom,
    maxZoom: mapMaxZoom,
    overzoomScale,
  };
  const markerOverlayProps = {
    markers: state.markers,
    customIcons: state.customMarkerIcons,
    mapRef,
    isMarkerEditMode: isMarkerEditorActive,
    activeMarkerId,
    onActiveMarkerChange: handleActiveMarkerChange,
    onMarkerPositionChange: handleMarkerPositionChange,
    onMarkerSizeChange: handleMarkerSizeChange,
    overzoomScale,
  };
  const routeOverlayProps = {
    routes: state.routes,
    mapRef,
    visible: form.showRoutes,
    overzoomScale,
  };
  const endpointProps = {
    ...routeOverlayProps,
    customIcons: state.customMarkerIcons,
    draggable: !state.routeDrawMode && state.routeEditMode,
    onEndpointDragEnd: handleRouteEndpointDragEnd,
    onViaPointDragEnd: handleViaPointDragEnd,
    onViaPointDelete: handleViaPointDelete,
  };

  return (
    <section className="preview-panel">
      <div className="poster-viewport">
        <div className="poster-ghost-layer" aria-hidden="true">
          <canvas ref={ghostCanvasRef} className="poster-ghost-canvas" />
        </div>
        <div className="desktop-layout-label" aria-hidden="true">
          {layoutLabel}
        </div>

        <div
          ref={frameRef}
          className={`poster-frame poster-frame--${form.mapShape}`}
          style={
            {
              "--poster-aspect": `${aspect}`,
              "--poster-bg": effectiveTheme.ui.bg,
              "--poster-border-color": getContrastBorderColor(effectiveTheme.ui.bg, 0.35),
            } as CSSProperties
          }
        >
          {isDualCity ? (
            <>
              <div className="dual-map-container">
                <div className="dual-map-half dual-map-half--left">
                  <MapPreview
                    style={mapStyle}
                    center={mapCenter}
                    zoom={mapZoom}
                    mapRef={mapRef}
                    {...commonMapProps}
                    onMove={handleMove}
                    onMoveEnd={handleMoveEnd}
                    radiusMeters={Number(form.radiusMeters) || 0}
                    radiusStyle={form.radiusStyle}
                    radiusLabel={form.radiusLabel}
                    containerStyle={{ width: "100%", height: "100%" }}
                  />
                </div>
                <div className="dual-map-half dual-map-half--right">
                  <MapPreview
                    style={mapStyle2}
                    center={mapCenter2}
                    zoom={mapZoom2}
                    mapRef={mapRef2}
                    {...{ ...commonMapProps, interactive: isEditing && !isMarkerEditorActive }}
                    onMove={handleMove2}
                    onMoveEnd={handleMoveEnd2}
                    containerStyle={{ width: "100%", height: "100%" }}
                  />
                </div>
              </div>
              {form.showMarkers && (
                <>
                  <GradientFades color={effectiveTheme.ui.bg} />
                  <GradientFades color={effectiveTheme2.ui.bg} />
                </>
              )}
              <RouteOverlay {...routeOverlayProps} />
              <RouteEndpointsOverlay {...endpointProps} />
              {hasVisibleMarkers && <MarkerOverlay {...markerOverlayProps} />}
              {form.showPois && (
                <PoiOverlay
                  mapRef={mapRef}
                  center={mapCenter}
                  visible={form.showPois}
                  activeTypes={activePois}
                />
              )}
              <DualPosterTextOverlay
                city1={cityLabel}
                country1={countryLabel}
                lat1={formLat}
                lon1={formLon}
                city2={form.displayCity2 || form.location2 || "Paris"}
                country2={form.displayCountry2 || "France"}
                lat2={formLat2}
                lon2={formLon2}
                fontFamily={form.fontFamily}
                textColor={effectiveTheme.ui.text}
                textColor2={effectiveTheme2.ui.text}
                landColor={effectiveTheme.map.land}
                showPosterText={form.showPosterText}
                includeCredits={form.includeCredits}
                showOverlay={form.showMarkers}
                showCoordinates={form.showCoordinates}
                titleAllCaps={form.titleAllCaps}
                showUnderline={form.showUnderline}
                letterSpacing={form.letterSpacing}
                coordsFormat={form.coordsFormat}
              />
            </>
          ) : (
            <>
              <MapPreview
                style={mapStyle}
                center={mapCenter}
                zoom={mapZoom}
                mapRef={mapRef}
                {...commonMapProps}
                onMove={handleMove}
                onMoveEnd={handleMoveEnd}
                radiusMeters={Number(form.radiusMeters) || 0}
                radiusStyle={form.radiusStyle}
                radiusLabel={form.radiusLabel}
              />
              {form.showMarkers && <GradientFades color={effectiveTheme.ui.bg} />}
              <RouteOverlay {...routeOverlayProps} />
              <RouteEndpointsOverlay {...endpointProps} />
              {form.showPois && (
                <PoiOverlay
                  mapRef={mapRef}
                  center={mapCenter}
                  visible={form.showPois}
                  activeTypes={activePois}
                />
              )}
              {hasVisibleMarkers && <MarkerOverlay {...markerOverlayProps} />}
              {!isPropertyCard && !isShopSignage && (
                <PosterTextOverlay
                  city={cityLabel}
                  country={countryLabel}
                  lat={formLat}
                  lon={formLon}
                  fontFamily={form.fontFamily}
                  textColor={effectiveTheme.ui.text}
                  landColor={effectiveTheme.map.land}
                  showPosterText={form.showPosterText}
                  includeCredits={form.includeCredits}
                  showOverlay={form.showMarkers}
                  showCoordinates={form.showCoordinates}
                  titleAllCaps={form.titleAllCaps}
                  showUnderline={form.showUnderline}
                  shape={form.mapShape as PosterShape}
                  letterSpacing={form.letterSpacing}
                  titleAlign={form.titleAlign}
                  coordsFormat={form.coordsFormat}
                />
              )}
            </>
          )}

          <PosterMediaOverlay
            qrUrl={qrPreviewUrl}
            showQrCode={form.showQrCode}
            qrPosition={form.qrPosition}
            qrX={form.qrX}
            qrY={form.qrY}
            qrSize={form.qrSize}
            qrOpacity={form.qrOpacity}
            qrPadding={form.qrPadding}
            qrLabel={form.qrLabel}
            logoUrl={form.logoUrl}
            logoPosition={form.logoPosition}
            logoX={form.logoX}
            logoY={form.logoY}
            logoSize={form.logoSize}
            logoOpacity={form.logoOpacity}
            logoPadding={form.logoPadding}
          />

          {isPropertyCard && (
            <PropertyCardOverlay form={form} cityLabel={cityLabel} theme={effectiveTheme.ui} />
          )}
          {isShopSignage && (
            <ShopSignageOverlay
              form={form}
              cityLabel={cityLabel}
              countryLabel={countryLabel}
              theme={effectiveTheme.ui}
            />
          )}

          {form.showBorder && <div className="poster-border" />}
          {!isDualCity && (
            <PosterFooterBar
              style={form.footerStyle}
              cityLabel={footerCityLabel}
              countryLabel={footerCountryLabel}
              theme={effectiveTheme.ui}
            />
          )}
        </div>

        {state.routeDrawMode && (
          <div ref={routeDrawOverlayRef} className="route-draw-hint">
            Click the map to place the start point
          </div>
        )}

        <SwipeHintOverlay
          isMobileViewport={isMobileViewport}
          isEditing={isEditing}
          isMarkerEditorActive={isMarkerEditorActive}
          routeDrawMode={state.routeDrawMode}
          swipeHandlers={swipeHandlers}
        />
      </div>

      <PosterInfoBadge
        form={form}
        layoutLabel={layoutLabel}
        isDualCity={isDualCity}
        isMobile={isMobileViewport}
        badgeVisible={badgeVisible}
        isEditing={isEditing}
        badgeTimerRef={badgeTimerRef}
        onVisibilityChange={setBadgeVisible}
      />

      <div className="map-controls" aria-label="Map controls">
        <PickerModal
          open={isUserGuideOpen}
          title={t("nav.userGuide" as any)}
          onClose={() => setIsUserGuideOpen(false)}
        >
          <UserGuide />
        </PickerModal>
        <div className="map-control-group">
          <MapPrimaryControls
            isMapEditing={isEditing}
            isMarkerEditorActive={isMarkerEditorActive}
            routeDrawMode={state.routeDrawMode}
            recenterHint={RECENTER_HINT}
            unlockHint={UNLOCK_HINT}
            onRecenter={handleRecenter}
            onStartEditing={handleStartEditing}
            onFinishEditing={handleFinishEditing}
            isRotationEnabled={isRotationEnabled}
            onToggleRotation={handleToggleRotation}
            onRotateBy={handleRotateBy}
            mapBearing={mapBearing}
            onBearingChange={handleBearingChange}
            onCompassReset={handleCompassReset}
          />
          {isMobileViewport && (
            <button
              type="button"
              className="map-control-btn user-guide-btn"
              onClick={() => setIsUserGuideOpen(true)}
              aria-label={t("nav.userGuide" as any)}
            >
              <InfoIcon />
            </button>
          )}
          <Suspense fallback={null}>
            <ExportFab isMobile={isMobileViewport} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
