import QRCode from "qrcode";

/**
 * Generates a QR code data URL client-side using the qrcode library.
 * Avoids CORS issues by producing a data URL locally.
 */
export async function getQrCodeDataUrl(data: string, size = 300): Promise<string> {
  try {
    return await QRCode.toDataURL(data, {
      width: size,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });
  } catch {
    return "";
  }
}

/**
 * Build a shareable navigation URL for a location.
 */
export function buildGoogleMapsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

/**
 * Build a WhatsApp message URL.
 */
export function buildWhatsAppUrl(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, "");
  return `https://wa.me/${cleanPhone}`;
}

/**
 * Build an Apple Maps URL.
 */
export function buildAppleMapsUrl(lat: number, lon: number): string {
  return `https://maps.apple.com/?q=${lat},${lon}`;
}

/**
 * Build a Telegram URL.
 */
export function buildTelegramUrl(username: string): string {
  const clean = username.replace(/^@/, "").trim();
  return clean ? `https://t.me/${clean}` : "";
}

/**
 * Build a Tee Tang hosted landing page URL.
 */
export function buildTeeTangUrl(lat: number, lon: number, city?: string): string {
  const slug = (city || "place")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return `https://teetangart.com/place/${slug}-${lat.toFixed(4)}-${lon.toFixed(4)}`;
}

/**
 * Preload a QR code image so it's ready for canvas export.
 */
export function preloadQrImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Data URLs don't need crossOrigin; external URLs do
    if (!url.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
