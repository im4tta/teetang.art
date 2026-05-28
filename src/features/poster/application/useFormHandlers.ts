import { useCallback } from "react";
import { usePosterContext } from "../ui/PosterContext";
import { clamp } from "@/shared/geo/math";
import { normalizePosterSizeValue, resolveLayoutIdForSize, formatLayoutCm } from "@/features/layout/domain/layoutMatcher";
import { getLayoutOption, layoutOptions } from "@/features/layout/infrastructure/layoutRepository";
import { MIN_POSTER_CM, MAX_POSTER_CM, MIN_DISTANCE_METERS, MAX_DISTANCE_METERS, LAYOUT_MATCH_TOLERANCE_CM } from "@/core/config";
import { addSearchHistory } from "@/shared/utils/searchHistory";
import type { SearchResult } from "@/features/location/domain/types";

export function useFormHandlers() {
  const { state, dispatch } = usePosterContext();

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = event.target as HTMLInputElement;
    const checked = "checked" in event.target ? (event.target as HTMLInputElement).checked : false;
    if (type === "checkbox") { dispatch({ type: "SET_FIELD", name, value: checked }); return; }
    if (name === "location" && !state.isLocationFocused) dispatch({ type: "SET_LOCATION_FOCUSED", focused: true });
    dispatch({ type: "SET_FIELD", name, value });
  }, [dispatch, state.isLocationFocused]);

  const handleNumericFieldBlur = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    const parsed = Number(value.trim());
    if (!value.trim() || !Number.isFinite(parsed)) return;

    if (name === "distance") {
      dispatch({ type: "SET_FIELD", name: "distance", value: String(Math.round(clamp(parsed, MIN_DISTANCE_METERS, MAX_DISTANCE_METERS))) });
      return;
    }
    if (name === "width" || name === "height") {
      const norm = clamp(parsed, MIN_POSTER_CM, MAX_POSTER_CM);
      const prevW = name === "width" ? norm : Number(state.form.width);
      const prevH = name === "height" ? norm : Number(state.form.height);
      const nW = normalizePosterSizeValue(prevW, norm, MIN_POSTER_CM, MAX_POSTER_CM);
      const nH = normalizePosterSizeValue(prevH, norm, MIN_POSTER_CM, MAX_POSTER_CM);
      dispatch({
        type: "SET_FORM_FIELDS",
        fields: {
          width: formatLayoutCm(nW), height: formatLayoutCm(nH),
          layout: resolveLayoutIdForSize(nW, nH, state.form.layout, LAYOUT_MATCH_TOLERANCE_CM, getLayoutOption(state.form.layout), layoutOptions),
        },
      });
    }
  }, [dispatch, state.form.width, state.form.height, state.form.layout]);

  const handleThemeChange = useCallback((themeId: string) => dispatch({ type: "SET_THEME", themeId }), [dispatch]);
  const handleTheme2Change = useCallback((themeId: string) => dispatch({ type: "SET_THEME2", themeId }), [dispatch]);

  const handleLayoutChange = useCallback((layoutId: string) => {
    const opt = getLayoutOption(layoutId);
    if (opt) dispatch({ type: "SET_LAYOUT", layoutId: opt.id, widthCm: formatLayoutCm(opt.widthCm), heightCm: formatLayoutCm(opt.heightCm) });
  }, [dispatch]);

  const handleColorChange = useCallback((key: string, value: string) => dispatch({ type: "SET_COLOR", key, value }), [dispatch]);
  const handleResetColors = useCallback(() => dispatch({ type: "RESET_COLORS" }), [dispatch]);

  const handleLocationSelect = useCallback((s: SearchResult) => {
    dispatch({ type: "SELECT_LOCATION", location: s });
    addSearchHistory({ label: s.label, lat: String(s.lat), lon: String(s.lon), city: s.city, country: s.country, continent: String(s.continent ?? "") });
  }, [dispatch]);

  const handleClearLocation = useCallback(() => dispatch({ type: "CLEAR_LOCATION" }), [dispatch]);
  const setLocationFocused = useCallback((focused: boolean) => dispatch({ type: "SET_LOCATION_FOCUSED", focused }), [dispatch]);
  const handleCreditsChange = useCallback((value: boolean) => dispatch({ type: "SET_FIELD", name: "includeCredits", value }), [dispatch]);

  return { handleChange, handleNumericFieldBlur, handleThemeChange, handleTheme2Change, handleLayoutChange, handleColorChange, handleResetColors, handleLocationSelect, handleClearLocation, setLocationFocused, handleCreditsChange };
}
