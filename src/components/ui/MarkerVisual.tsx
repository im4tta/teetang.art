import { memo, type CSSProperties } from "react";
import type { MarkerIconDefinition } from "@/services/markers/types";

interface MarkerVisualProps {
  icon: MarkerIconDefinition;
  size: number;
  color: string;
  className?: string;
}

const MarkerVisual = memo(function MarkerVisual({
  icon,
  size,
  color,
  className = "",
}: MarkerVisualProps) {
  const isThemeTintedMarkerSvg =
    icon.kind === "image" && Boolean(icon.tintWithMarkerColor) && Boolean(icon.dataUrl);

  return (
    <span
      className={`marker-visual ${className}`.trim()}
      style={
        {
          "--marker-size": `${size}px`,
          "--marker-color": color,
        } as CSSProperties
      }
    >
      {isThemeTintedMarkerSvg ? (
        <span
          className="marker-visual__image-mask"
          aria-hidden="true"
          style={
            {
              "--marker-mask-url": `url(${icon.dataUrl})`,
            } as CSSProperties
          }
        />
      ) : icon.kind === "image" && icon.dataUrl ? (
        <img className="marker-visual__image" src={icon.dataUrl} alt="" aria-hidden="true" />
      ) : icon.component ? (
        <span className="marker-visual__icon" aria-hidden="true">
          <icon.component size={size} color={color} />
        </span>
      ) : (
        <span
          className="marker-visual__icon"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: icon.svgMarkup ?? "" }}
        />
      )}
    </span>
  );
});

export default MarkerVisual;
