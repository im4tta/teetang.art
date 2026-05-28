export const toRadians = (v: number) => (v * Math.PI) / 180;
export const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

const R = 6_371_000;
export function haversineMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const [dLat, dLon] = [toRadians(b.lat - a.lat), toRadians(b.lon - a.lon)];
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
