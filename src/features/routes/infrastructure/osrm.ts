import type { Coordinate } from "@/shared/geo/types";

export async function fetchOsrmRoute(waypoints: [number, number][]): Promise<Coordinate[] | null> {
  if (waypoints.length < 2) return null;
  try {
    const coordsStr = waypoints.map((p) => `${p[1]},${p[0]}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === "Ok" && data.routes?.length > 0) {
      return data.routes[0].geometry.coordinates.map((c: [number, number]) => ({
        lon: c[0],
        lat: c[1],
      }));
    }
  } catch {
    // fallback to direct line
  }
  return null;
}
