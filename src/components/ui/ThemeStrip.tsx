import { useEffect, useRef } from "react";
import { usePosterContext } from "@/context/PosterContext";
import { themeOptions } from "@/services/theme/themeRepository";
import { tapFeedback } from "@/utils/haptics";
import { revealHorizontally } from "@/utils/dom";

/**
 * One-row, swipeable theme picker for the phone sheet's first (peek) height,
 * so the poster stays in view while trying themes.
 */
export default function ThemeStrip() {
  const { state, dispatch } = usePosterContext();
  const selected = state.form.theme;
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    revealHorizontally(
      listRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]'),
      "center",
    );
  }, [selected]);

  return (
    <div className="theme-strip" ref={listRef} role="group" aria-label="Themes">
      {themeOptions.map((option) => (
        <button
          key={option.id}
          type="button"
          className="theme-strip__item"
          aria-pressed={option.id === selected}
          onClick={() => {
            tapFeedback();
            dispatch({ type: "SET_THEME", themeId: option.id });
          }}
        >
          <span className="theme-strip__swatch" aria-hidden="true">
            {option.palette.slice(0, 4).map((color, index) => (
              <span key={index} style={{ background: color }} />
            ))}
          </span>
          <span className="theme-strip__name">{option.name}</span>
        </button>
      ))}
    </div>
  );
}
