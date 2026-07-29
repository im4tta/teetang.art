import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import ThemeCard from "@/components/ui/ThemeCard";
import { EditIcon } from "@/components/ui/Icons";
import type { ThemeOption, ThemeGroup } from "@/services/theme/types";

interface ThemeSummarySectionProps {
  listRef?: RefObject<HTMLDivElement>;
  themeOptions: ThemeOption[];
  themeGroups: ThemeGroup[];
  selectedThemeId: string;
  selectedThemeOption: ThemeOption;
  onThemeSelect: (themeId: string) => void;
  onCustomize: () => void;
}

const ALL_GROUP_ID = "all";

export default function ThemeSummarySection({
  listRef,
  themeOptions,
  themeGroups,
  selectedThemeId,
  selectedThemeOption,
  onThemeSelect,
  onCustomize,
}: ThemeSummarySectionProps) {
  const [activeGroupId, setActiveGroupId] = useState<string>(ALL_GROUP_ID);
  const localListRef = useRef<HTMLDivElement | null>(null);
  const resolvedListRef = listRef ?? localListRef;

  const description = selectedThemeOption.description?.trim() || "No description available.";

  const visibleOptions =
    activeGroupId === ALL_GROUP_ID
      ? themeOptions
      : (themeGroups.find((group) => group.id === activeGroupId)?.options ?? themeOptions);

  useEffect(() => {
    const selectedCard = resolvedListRef.current?.querySelector<HTMLElement>(
      ".theme-card.is-selected",
    );
    selectedCard?.scrollIntoView({ behavior: "auto", block: "nearest", inline: "start" });
  }, [activeGroupId, resolvedListRef, selectedThemeId]);

  const groupChips = [{ id: ALL_GROUP_ID, name: "All" }, ...themeGroups];

  return (
    <div className="theme-summary-view">
      <div className="theme-summary-head">
        <div className="theme-summary-copy">
          <p className="theme-summary-label">
            Theme: <span className="theme-summary-label-name">{selectedThemeOption.name}</span>
          </p>
          <p className="theme-card-description">{description}</p>
        </div>
        <button
          type="button"
          className="theme-customize-btn"
          onClick={onCustomize}
          aria-label={`Customize ${selectedThemeOption.name} colors`}
        >
          <span className="theme-customize-icon" aria-hidden="true">
            <EditIcon />
          </span>
        </button>
      </div>

      <div className="theme-group-chips" role="tablist" aria-label="Theme presets">
        {groupChips.map((group) => (
          <button
            key={group.id}
            type="button"
            role="tab"
            aria-selected={activeGroupId === group.id}
            className={`theme-group-chip${activeGroupId === group.id ? " is-active" : ""}`}
            onClick={() => setActiveGroupId(group.id)}
          >
            {group.name}
          </button>
        ))}
      </div>

      <div
        className="theme-card-list card-scroll-list"
        role="list"
        aria-label="Theme options"
        ref={resolvedListRef}
      >
        {visibleOptions.map((themeOption) => (
          <ThemeCard
            key={themeOption.id}
            themeOption={themeOption}
            isSelected={themeOption.id === selectedThemeId}
            onClick={() => onThemeSelect(themeOption.id)}
          />
        ))}
      </div>
    </div>
  );
}
