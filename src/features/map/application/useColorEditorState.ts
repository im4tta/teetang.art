import { useMemo, useState } from "react";
import {
  DISPLAY_PALETTE_KEYS,
  PALETTE_COLOR_LABELS,
  type ThemeColorKey,
} from "@/features/theme/domain/types";
import type { ResolvedTheme } from "@/features/theme/domain/types";
import { getThemeColorByPath } from "@/features/theme/domain/colorPaths";
import { normalizeHexColor } from "@/shared/utils/color";
import { buildDynamicColorChoices } from "@/features/theme/domain/colorSuggestions";

const FALLBACK_COLOR = "#000000";

export interface ColorTarget {
  key: ThemeColorKey;
  label: string;
  color: string;
  isActive: boolean;
}

export interface ColorEditorState {
  activeColorKey: ThemeColorKey | null;
  activeColorLabel: string;
  activeColorChoices: { suggestedColors: string[]; moreColors: string[] };
  colorTargets: ColorTarget[];
  currentThemePalette: string[];
  hasCustomColors: boolean;
  editorKey: ThemeColorKey;
  editorColor: string;
  originalEditorColor: string;
  canResetEditorColor: boolean;
  handleSwatchClick: (key: ThemeColorKey) => void;
  clearColorPickerState: () => void;
  handleResetThemeColors: (onResetColors: () => void) => void;
  handleResetSingleColor: (key: ThemeColorKey, onColorChange: (k: string, v: string) => void) => void;
}

interface UseColorEditorStateOptions {
  selectedTheme: ResolvedTheme;
  customColors: Record<string, string>;
}

export function useColorEditorState({
  selectedTheme,
  customColors,
}: UseColorEditorStateOptions): ColorEditorState {
  const defaultColorKey: ThemeColorKey = DISPLAY_PALETTE_KEYS[0] ?? "ui.bg";

  const [activeColorKey, setActiveColorKey] = useState<ThemeColorKey | null>(null);
  const [activeColorSession, setActiveColorSession] = useState<{
    key: ThemeColorKey;
    seedColor: string;
    seedPalette: string[];
  } | null>(null);

  const currentThemePalette = useMemo(
    () =>
      DISPLAY_PALETTE_KEYS.map(key => {
        const themeColor = getThemeColorByPath(selectedTheme, key) || FALLBACK_COLOR;
        return customColors[key] ?? themeColor;
      }),
    [customColors, selectedTheme],
  );

  const activeColorChoices = useMemo(() => {
    if (!activeColorKey) return { suggestedColors: [], moreColors: [] };

    const sessionColor =
      activeColorSession?.key === activeColorKey ? activeColorSession.seedColor : "";
    const sessionPalette =
      activeColorSession?.key === activeColorKey
        ? activeColorSession.seedPalette
        : currentThemePalette;

    return buildDynamicColorChoices(
      sessionColor ||
        customColors[activeColorKey] ||
        getThemeColorByPath(selectedTheme, activeColorKey) ||
        currentThemePalette[0] ||
        "",
      sessionPalette,
    );
  }, [activeColorKey, activeColorSession, customColors, currentThemePalette, selectedTheme]);

  const colorTargets: ColorTarget[] = useMemo(
    () =>
      DISPLAY_PALETTE_KEYS.map(key => {
        const baseColor = getThemeColorByPath(selectedTheme, key) || FALLBACK_COLOR;
        const currentColor = customColors[key] ?? baseColor;
        return {
          key,
          label: PALETTE_COLOR_LABELS[key] ?? key,
          color: currentColor,
          isActive: activeColorKey === key,
        };
      }),
    [activeColorKey, customColors, selectedTheme],
  );

  const hasCustomColors = useMemo(
    () =>
      DISPLAY_PALETTE_KEYS.some(key => {
        const override = normalizeHexColor(customColors[key]);
        if (!override) return false;
        const original = normalizeHexColor(getThemeColorByPath(selectedTheme, key));
        return override !== original;
      }),
    [customColors, selectedTheme],
  );

  const activeColorLabel = activeColorKey
    ? (PALETTE_COLOR_LABELS[activeColorKey] ?? "Color")
    : "Color";

  // Derived editor values for the active color slot
  const editorKey = activeColorKey || defaultColorKey;
  const editorColor =
    customColors[editorKey] ??
    (getThemeColorByPath(selectedTheme, editorKey) || currentThemePalette[0] || "");
  const originalEditorColor =
    normalizeHexColor(getThemeColorByPath(selectedTheme, editorKey)) ||
    normalizeHexColor(currentThemePalette[0]) ||
    "";
  const normalizedEditorColor = normalizeHexColor(editorColor) || "";
  const canResetEditorColor = Boolean(
    originalEditorColor && normalizedEditorColor && originalEditorColor !== normalizedEditorColor,
  );

  function clearColorPickerState() {
    setActiveColorKey(null);
    setActiveColorSession(null);
  }

  function handleSwatchClick(key: ThemeColorKey) {
    const themeColor = getThemeColorByPath(selectedTheme, key);
    const seedColor = customColors[key] ?? (themeColor || currentThemePalette[0] || "");
    setActiveColorKey(key);
    setActiveColorSession({ key, seedColor, seedPalette: [...currentThemePalette] });
  }

  function handleResetThemeColors(onResetColors: () => void) {
    onResetColors();
    const activeKey = activeColorKey || defaultColorKey;
    const seedPalette = DISPLAY_PALETTE_KEYS.map(
      key =>
        normalizeHexColor(getThemeColorByPath(selectedTheme, key)) ||
        normalizeHexColor(currentThemePalette[0]) ||
        "",
    );
    setActiveColorSession({
      key: activeKey,
      seedColor: seedPalette[DISPLAY_PALETTE_KEYS.indexOf(activeKey)] || seedPalette[0] || "",
      seedPalette,
    });
  }

  function handleResetSingleColor(
    key: ThemeColorKey,
    onColorChange: (k: string, v: string) => void,
  ) {
    const originalColor =
      normalizeHexColor(getThemeColorByPath(selectedTheme, key)) ||
      normalizeHexColor(currentThemePalette[0]) ||
      "";
    if (!originalColor) return;
    onColorChange(key, originalColor);
  }

  return {
    activeColorKey,
    activeColorLabel,
    activeColorChoices,
    colorTargets,
    currentThemePalette,
    hasCustomColors,
    editorKey,
    editorColor,
    originalEditorColor,
    canResetEditorColor,
    handleSwatchClick,
    clearColorPickerState,
    handleResetThemeColors,
    handleResetSingleColor,
  };
}
