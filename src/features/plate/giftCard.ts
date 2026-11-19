/**
 * A gift card for a plate: a 6 × 4 inch landscape card at 300 dpi with the
 * plate on the left and, on the right, the place, a personal line and a QR
 * code that opens the same plate in 3D.
 */
import { getQrCodeDataUrl } from "@/utils/qrCode";
import type { PlateSettings } from "./plateSettings";

const WIDTH = 1800;
const HEIGHT = 1200;
const SERIF = 'Georgia, "Times New Roman", "Kantumruy Pro", serif';
const MONO = '"JetBrains Mono", "Kantumruy Pro", ui-monospace, monospace';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image failed"));
    image.src = src;
  });
}

/** Crops a transparent snapshot to its visible pixels. */
function cropToContent(shot: HTMLCanvasElement): [number, number, number, number] {
  const { width, height } = shot;
  const { data } = shot.getContext("2d")!.getImageData(0, 0, width, height);
  let left = width,
    right = 0,
    top = height,
    bottom = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (data[(y * width + x) * 4 + 3] < 8) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return right > left ? [left, top, right - left + 1, bottom - top + 1] : [0, 0, width, height];
}

/** Wraps text into lines no wider than `width` at the current font. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export async function buildGiftCard(
  shot: HTMLCanvasElement,
  plate: PlateSettings,
  link: string,
  texts: { scan: string; highest: string },
  highestMetres: number | null,
): Promise<Blob> {
  const canvas = Object.assign(document.createElement("canvas"), { width: WIDTH, height: HEIGHT });
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = plate.paper;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // A thin frame, like a printed card.
  ctx.strokeStyle = plate.ink;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, WIDTH - 96, HEIGHT - 96);
  ctx.globalAlpha = 1;

  // The plate, fitted into the left part.
  const [sx, sy, sw, sh] = cropToContent(shot);
  const box = { x: 90, y: 110, w: 980, h: 980 };
  const scale = Math.min(box.w / sw, box.h / sh);
  ctx.drawImage(
    shot,
    sx,
    sy,
    sw,
    sh,
    box.x + (box.w - sw * scale) / 2,
    box.y + (box.h - sh * scale) / 2,
    sw * scale,
    sh * scale,
  );

  // Text column.
  const left = 1130;
  const right = WIDTH - 110;
  const column = right - left;
  ctx.fillStyle = plate.ink;
  ctx.textBaseline = "alphabetic";
  let y = 250;
  ctx.font = `700 76px ${SERIF}`;
  for (const line of wrap(ctx, plate.name || "", column).slice(0, 3)) {
    ctx.fillText(line, left, y);
    y += 88;
  }
  const subtitle = [plate.region, plate.country].filter(Boolean).join(", ");
  ctx.font = `400 34px ${MONO}`;
  ctx.globalAlpha = 0.75;
  if (subtitle) {
    ctx.fillText(subtitle, left, y);
    y += 56;
  }
  if (highestMetres !== null) {
    ctx.fillText(
      `▲ ${Math.round(highestMetres).toLocaleString("en-US")} m ${texts.highest}`,
      left,
      y,
    );
    y += 56;
  }
  ctx.fillText(`${plate.lat.toFixed(4)}°, ${plate.lon.toFixed(4)}°`, left, y);
  ctx.globalAlpha = 1;
  y += 90;
  if (plate.note.trim()) {
    ctx.font = `italic 400 44px ${SERIF}`;
    for (const line of wrap(ctx, `“${plate.note.trim()}”`, column).slice(0, 3)) {
      ctx.fillText(line, left, y);
      y += 58;
    }
  }

  // QR code to the live plate, bottom right.
  const qrSize = 300;
  const dataUrl = await getQrCodeDataUrl(link, qrSize);
  if (dataUrl) {
    const qr = await loadImage(dataUrl);
    const qx = right - qrSize;
    const qy = HEIGHT - 110 - qrSize - 50;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(qx - 12, qy - 12, qrSize + 24, qrSize + 24);
    ctx.drawImage(qr, qx, qy, qrSize, qrSize);
    ctx.fillStyle = plate.ink;
    ctx.font = `500 28px ${MONO}`;
    ctx.textAlign = "right";
    ctx.fillText(texts.scan, right, qy + qrSize + 56);
    ctx.textAlign = "left";
  }
  ctx.font = `500 26px ${MONO}`;
  ctx.globalAlpha = 0.6;
  ctx.fillText("teetang.art", left, HEIGHT - 120);
  ctx.globalAlpha = 1;

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/png"),
  );
}
