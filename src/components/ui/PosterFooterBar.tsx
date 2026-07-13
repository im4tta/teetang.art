import type { ResolvedTheme } from "@/services/theme/types";

interface Props {
  style: string;
  cityLabel: string;
  countryLabel: string;
  theme: Pick<ResolvedTheme["ui"], "bg" | "text">;
}

/**
 * Thin footer bar shown at the bottom of the poster frame.
 * Supports "none", "solid", and other style variants via CSS class.
 */
export default function PosterFooterBar({ style, cityLabel, countryLabel, theme }: Props) {
  if (style === "none") return null;

  const separator = cityLabel && countryLabel ? ", " : "";

  return (
    <div
      className={`poster-footer-bar poster-footer-bar--${style}`}
      style={{ backgroundColor: style === "solid" ? theme.bg : undefined }}
    >
      <span className="poster-footer-text" style={{ color: theme.text }}>
        {cityLabel}{separator}{countryLabel}
      </span>
    </div>
  );
}
