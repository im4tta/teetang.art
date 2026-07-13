import { useEffect, useMemo, useRef, useState } from "react";
import { createCustomLayoutOption } from "@/services/layout/layoutRepository";
import { type ThemeColorKey, type ThemeOption } from "@/services/theme/types";
import { buildDynamicColorChoices } from "@/services/theme/colorSuggestions";
import { createFallbackThemeOption } from "@/services/theme/colorSuggestions";
import LayoutCard from "@/components/ui/LayoutCard";
import MapDimensionFields from "@/components/ui/MapDimensionFields";
import ColorPicker from "@/components/ui/ColorPicker";
import ThemeColorEditor from "@/components/ui/ThemeColorEditor";
import ThemeSummarySection from "@/components/ui/ThemeSummarySection";
import { CheckIcon, EditIcon } from "@/components/ui/Icons";
import type { ResolvedTheme, ThemeGroup } from "@/services/theme/types";
import type { LayoutGroup } from "@/services/layout/types";
import { useColorEditorState } from "@/hooks/useColorEditorState";

interface MapSettingsForm {
  theme: string;
  layout: string;
  width: string;
  height: string;
  distance: string;
  includeBuildings: boolean;
  includeWater: boolean;
  includeParks: boolean;
  includeAeroway: boolean;
  includeRail: boolean;
  includeRoads: boolean;
  includeRoadPath: boolean;
  includeRoadMinorLow: boolean;
  includeRoadOutline: boolean;
}

interface MapSettingsSectionProps {
  activeMobileTab?: string;
  form: MapSettingsForm;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onNumericFieldBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  onThemeChange: (themeId: string) => void;
  onLayoutChange: (layoutId: string) => void;
  selectedTheme: ResolvedTheme;
  themeOptions: ThemeOption[];
  themeGroups: ThemeGroup[];
  layoutGroups: LayoutGroup[];
  minPosterCm: number;
  maxPosterCm: number;
  customColors: Record<string, string>;
  onColorChange: (key: string, value: string) => void;
  onResetColors: () => void;
  onColorEditorActiveChange?: (active: boolean) => void;
}

export default function MapSettingsSection({
  activeMobileTab,
  form,
  onChange,
  onNumericFieldBlur,
  onThemeChange,
  onLayoutChange,
  selectedTheme,
  themeOptions,
  themeGroups,
  layoutGroups,
  minPosterCm,
  maxPosterCm,
  customColors,
  onColorChange,
  onResetColors,
  onColorEditorActiveChange,
}: MapSettingsSectionProps) {
  const [isThemeEditing, setIsThemeEditing] = useState(false);
  const [isLayoutEditing, setIsLayoutEditing] = useState(false);
  const themeListRef = useRef<HTMLDivElement | null>(null);
  const layoutGroupsRef = useRef<HTMLDivElement | null>(null);

  const colorEditor = useColorEditorState({ selectedTheme, customColors });

  const selectedThemeOption = useMemo(() => {
    const matchingOption = themeOptions.find((t) => t.id === form.theme);
    if (matchingOption) return matchingOption;
    return createFallbackThemeOption(form.theme, selectedTheme);
  }, [form.theme, selectedTheme, themeOptions]);

  const summaryThemeOption = useMemo(
    () => ({ ...selectedThemeOption, palette: colorEditor.currentThemePalette }),
    [colorEditor.currentThemePalette, selectedThemeOption],
  );

  const layoutOptions = useMemo(() => layoutGroups.flatMap((g) => g.options), [layoutGroups]);

  const selectedLayoutOption = useMemo(() => {
    const match = layoutOptions.find((lo) => lo.id === form.layout);
    if (match) return match;
    return createCustomLayoutOption(Number(form.width), Number(form.height));
  }, [form.height, form.layout, form.width, layoutOptions]);

  const selectedLayoutDescription =
    selectedLayoutOption.id === "custom"
      ? "Your custom layout."
      : selectedLayoutOption.description?.trim() || "No description available.";

  function handleThemeSelect(themeId: string) {
    onThemeChange(themeId);
    colorEditor.clearColorPickerState();
  }

  function handleLayoutSelectInline(layoutId: string) {
    onLayoutChange(layoutId);
    setIsLayoutEditing(false);
  }

  function handleOpenThemeEditor() {
    setIsThemeEditing(true);
    colorEditor.clearColorPickerState();
  }

  function handleDoneThemeEditor() {
    setIsThemeEditing(false);
    colorEditor.clearColorPickerState();
  }

  function handleOpenLayoutEditor() {
    setIsLayoutEditing(true);
    onLayoutChange("custom");
  }

  function handleDoneLayoutEditor() {
    setIsLayoutEditing(false);
  }

  function handleResetThemeColors() {
    if (!isThemeEditing) {
      onResetColors();
      colorEditor.clearColorPickerState();
      return;
    }
    colorEditor.handleResetThemeColors(onResetColors);
  }

  const editorChoices = colorEditor.activeColorKey
    ? colorEditor.activeColorChoices
    : buildDynamicColorChoices(
        colorEditor.currentThemePalette[0] || "",
        colorEditor.currentThemePalette,
      );

  useEffect(() => {
    onColorEditorActiveChange?.(false);
    return () => { onColorEditorActiveChange?.(false); };
  }, [onColorEditorActiveChange]);

  useEffect(() => {
    if (activeMobileTab !== "theme") return;
    const frameId = window.requestAnimationFrame(() => {
      const selectedThemeCard = themeListRef.current?.querySelector<HTMLElement>(".theme-card.is-selected");
      selectedThemeCard?.scrollIntoView({ behavior: "auto", block: "nearest", inline: "start" });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [activeMobileTab]);

  useEffect(() => {
    if (activeMobileTab !== "layout" || isLayoutEditing) return;
    const frameId = window.requestAnimationFrame(() => {
      const selectedLayoutCard = layoutGroupsRef.current?.querySelector<HTMLElement>(".layout-card.is-selected");
      selectedLayoutCard?.scrollIntoView({ behavior: "auto", block: "nearest", inline: "start" });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [activeMobileTab, isLayoutEditing]);

  const showTheme = !activeMobileTab || activeMobileTab === "theme";
  const showLayout = !activeMobileTab || activeMobileTab === "layout";

  return (
    <section className="panel-block">
      {showTheme ? (
        <div className="map-settings-theme-part">
          <h2>Theme</h2>

          {isThemeEditing ? (
            colorEditor.activeColorKey ? (
              <section className="panel-block color-editor-screen">
                <h2>Color Editor</h2>
                <div className="color-editor-header">
                  <p className="theme-active-label">Editing: {colorEditor.activeColorLabel}</p>
                  <div className="theme-edit-actions">
                    <button type="button" className="theme-edit-done-btn" onClick={colorEditor.clearColorPickerState}>
                      Done
                    </button>
                  </div>
                </div>

                <ColorPicker
                  currentColor={colorEditor.editorColor}
                  suggestedColors={editorChoices.suggestedColors}
                  moreColors={editorChoices.moreColors}
                  onChange={(color: string) => onColorChange(colorEditor.editorKey, color)}
                  onResetColor={() => colorEditor.handleResetSingleColor(colorEditor.editorKey as ThemeColorKey, onColorChange)}
                  canResetColor={colorEditor.canResetEditorColor}
                />
              </section>
            ) : (
              <ThemeColorEditor
                activeColorLabel={colorEditor.activeColorLabel}
                hasCustomColors={colorEditor.hasCustomColors}
                onResetAllColors={handleResetThemeColors}
                onDone={handleDoneThemeEditor}
                colorTargets={colorEditor.colorTargets}
                onTargetSelect={colorEditor.handleSwatchClick}
              />
            )
          ) : (
            <ThemeSummarySection
              listRef={themeListRef}
              themeOptions={themeOptions}
              themeGroups={themeGroups}
              selectedThemeId={form.theme}
              selectedThemeOption={summaryThemeOption}
              onThemeSelect={handleThemeSelect}
              onCustomize={handleOpenThemeEditor}
            />
          )}
        </div>
      ) : null}

      {showLayout ? (
        <div className="map-settings-layout-part">
          <h2>Layout</h2>
          <div className="layout-summary-head">
            <div className="layout-summary-copy">
              <p className="layout-summary-label">
                LAYOUT:{" "}
                <span className="layout-summary-label-name">{selectedLayoutOption.name}</span>
              </p>
              <p className="layout-summary-description">{selectedLayoutDescription}</p>
            </div>
            {isLayoutEditing ? (
              <button type="button" className="theme-customize-btn" onClick={handleDoneLayoutEditor} aria-label="Done editing layout">
                <span className="theme-customize-icon" aria-hidden="true"><CheckIcon /></span>
              </button>
            ) : (
              <button type="button" className="theme-customize-btn" onClick={handleOpenLayoutEditor} aria-label="Customize layout size">
                <span className="theme-customize-icon" aria-hidden="true"><EditIcon /></span>
              </button>
            )}
          </div>

          {isLayoutEditing ? (
            <div className="layout-custom-editor">
              <MapDimensionFields
                form={form}
                minPosterCm={minPosterCm}
                maxPosterCm={maxPosterCm}
                onChange={onChange}
                onNumericFieldBlur={onNumericFieldBlur}
                showDistanceField={false}
              />
            </div>
          ) : (
            <div className="layout-inline-groups" ref={layoutGroupsRef}>
              {layoutGroups.map((group) => (
                <section key={group.id} className="layout-inline-group">
                  <h3>{group.name}</h3>
                  <div className="layout-inline-list card-scroll-list">
                    {group.options.map((layoutOption) => (
                      <LayoutCard
                        key={layoutOption.id}
                        layoutOption={layoutOption}
                        isSelected={layoutOption.id === form.layout}
                        onClick={() => handleLayoutSelectInline(layoutOption.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
