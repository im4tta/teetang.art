/**
 * Generates a QR code data URL client-side using the qrcode library.
 * Avoids CORS issues by producing a data URL locally.
 */
export async function getQrCodeDataUrl(data: string, size = 300): Promise<string> {
  try {
    // Loaded on first use: the encoder is only needed once a QR code is shown.
    const { default: QRCode } = await import("qrcode");
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
