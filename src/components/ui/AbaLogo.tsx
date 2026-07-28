interface AbaLogoProps {
  className?: string;
  title?: string;
}

/**
 * ABA wordmark badge used for the bank transfer support option.
 * Rendered as inline SVG so it stays crisp at any size and works in both themes.
 */
export default function AbaLogo({ className, title }: AbaLogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      role="img"
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <rect x="0" y="0" width="64" height="64" rx="14" fill="#00285A" />
      <text
        x="32"
        y="41"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="'Bebas Neue', 'Arial Narrow', Arial, sans-serif"
        fontSize="26"
        fontWeight="700"
        letterSpacing="1.5"
      >
        ABA
      </text>
    </svg>
  );
}
