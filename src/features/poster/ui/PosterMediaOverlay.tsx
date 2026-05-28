interface PosterMediaOverlayProps {
  qrUrl: string;
  showQrCode: boolean;
  qrPosition: string;
  qrX?: string;
  qrY?: string;
  qrSize?: string;
  qrOpacity?: string;
  qrPadding?: string;
  qrLabel?: string;
  logoUrl: string;
  logoPosition: string;
  logoX?: string;
  logoY?: string;
  logoSize?: string;
  logoOpacity?: string;
  logoPadding?: string;
}

function presetToXY(position: string): { x: number; y: number } {
  switch (position) {
    case "top-left":
      return { x: 8, y: 8 };
    case "top-right":
      return { x: 92, y: 8 };
    case "bottom-left":
      return { x: 8, y: 92 };
    case "bottom-right":
      return { x: 92, y: 92 };
    case "center":
      return { x: 50, y: 50 };
    default:
      return { x: 92, y: 92 };
  }
}

export default function PosterMediaOverlay({
  qrUrl,
  showQrCode,
  qrPosition,
  qrX,
  qrY,
  qrSize = "12",
  qrOpacity = "100",
  qrPadding = "6",
  qrLabel = "",
  logoUrl,
  logoPosition,
  logoX,
  logoY,
  logoSize = "25",
  logoOpacity = "100",
  logoPadding = "0",
}: PosterMediaOverlayProps) {
  const qrPreset = presetToXY(qrPosition);
  const logoPreset = presetToXY(logoPosition);
  const qrPosX = Number(qrX && qrX !== "" ? qrX : qrPreset.x);
  const qrPosY = Number(qrY && qrY !== "" ? qrY : qrPreset.y);
  const logoPosX = Number(logoX && logoX !== "" ? logoX : logoPreset.x);
  const logoPosY = Number(logoY && logoY !== "" ? logoY : logoPreset.y);

  const qrStyle: React.CSSProperties = {
    position: "absolute",
    left: `${qrPosX}%`,
    top: `${qrPosY}%`,
    transform: "translate(-50%, -50%)",
    width: `${qrSize}cqmin`,
    height: `${qrSize}cqmin`,
    opacity: Number(qrOpacity) / 100,
    padding: `${qrPadding}px`,
  };

  const logoStyle: React.CSSProperties = {
    position: "absolute",
    left: `${logoPosX}%`,
    top: `${logoPosY}%`,
    transform: "translate(-50%, -50%)",
    width: `${logoSize}cqw`,
    maxWidth: `${logoSize}cqw`,
    height: "auto",
    maxHeight: "10cqh",
    objectFit: "contain",
    opacity: Number(logoOpacity) / 100,
    padding: `${logoPadding}px`,
  };

  return (
    <div className="poster-media-overlay" aria-hidden="true">
      {showQrCode && qrUrl ? (
        <div className="poster-qr-wrapper" style={qrStyle}>
          <img className="poster-qr-img" src={qrUrl} alt="" draggable={false} />
          {qrLabel ? <span className="poster-qr-label">{qrLabel}</span> : null}
        </div>
      ) : null}

      {logoUrl ? (
        <img className="poster-logo" src={logoUrl} style={logoStyle} alt="" draggable={false} />
      ) : null}
    </div>
  );
}
